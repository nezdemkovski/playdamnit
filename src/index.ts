import { Context, Elysia, status } from "elysia";
import { openapi } from '@elysiajs/openapi'

import { routes } from "@/routes";
import logger, {
  LogLevel,
  initSentry,
  isSentryEnabled,
  flushSentry,
} from "@/utils/enhancedLogger";
import { auth } from "./lib/auth";
import { getCors } from "@/utils/getCors";
import { getConfig } from "@/config";
import { getBoss, stopBoss } from "@/utils/pgBoss";
import { initNotifyListener, closeNotifyListener } from "@/utils/pgNotify";
import { AppError, TooManyRequestsError } from "@/utils/errors";
import { backfillMissingLibraryGames } from "@/utils/catalogRequests";
import { db } from "@/db/postgres";
import { sql } from "drizzle-orm";

const { postgresUrl, betterAuthSecret, resendApiKey, isDev } = getConfig();

const validateEnvironment = () => {
  const missingVars = [];

  if (!postgresUrl) {
    missingVars.push("POSTGRES_URL");
  }

  if (!isDev) {
    if (!betterAuthSecret) missingVars.push("BETTER_AUTH_SECRET");
    // Sign-up requires email verification, so production can't work without email
    if (!resendApiKey) missingVars.push("RESEND_API_KEY");
  }

  if (missingVars.length > 0) {
    logger.error(
      `Missing required environment variables: ${missingVars.join(", ")}`
    );
    logger.system(
      "Application startup aborted: Configure the missing environment variables and restart"
    );
    process.exit(1);
  }

  return true;
};

const logLevel = (process.env.LOG_LEVEL || "info") as LogLevel;

logger.level = logLevel;
logger.system(`Starting playdamnit API with log level: ${logLevel}`);

validateEnvironment();

const sentryEnabled = initSentry();
if (sentryEnabled) {
  logger.system("Sentry error tracking enabled");
} else {
  logger.system("Sentry error tracking disabled");
}

const betterAuthView = (context: Context) => {
  const BETTER_AUTH_ACCEPT_METHODS = ["POST", "GET"];
  if (BETTER_AUTH_ACCEPT_METHODS.includes(context.request.method)) {
    return auth.handler(context.request);
  } else {
    return new Response("Method Not Allowed", { status: 405 });
  }
};

const setupApp = async () => {
  // Initialize pg-boss (job queue) and LISTEN/NOTIFY
  await getBoss();
  logger.system("pg-boss started");

  await initNotifyListener();

  backfillMissingLibraryGames()
    .then((count) => count && logger.system(`Requested ${count} library games missing from the catalog`))
    .catch((error) => logger.exception(error, { source: "backfill-library-games" }));

  const app = new Elysia({ name: "playdamnit-api" })
    .use(openapi())
    .use(getCors())
    .onError(({ code, error, path, request, set }) => {
      // Special case: don't log favicon 404s
      if (code === "NOT_FOUND" && path === "/favicon.ico") {
        return status(204, null);
      }

      // Errors thrown on purpose by services
      if (error instanceof AppError) {
        if (error.statusCode >= 500) {
          logger.exception(error, { path, method: request.method });
        }
        if (error instanceof TooManyRequestsError && error.retryAfterSeconds) {
          set.headers["retry-after"] = String(error.retryAfterSeconds);
        }
        return status(error.statusCode, {
          error: error.errorType,
          message: error.message,
        });
      }

      // Log all errors with context
      logger.exception(error, {
        code,
        path,
        method: request.method,
        url: request.url
      });

      // Handle validation errors
      if (code === "VALIDATION") {
        return status(400, {
          error: "Validation Error",
          message: error instanceof Error ? error.message : "Invalid request data",
        });
      }

      // Handle parse errors
      if (code === "PARSE") {
        return status(400, {
          error: "Parse Error",
          message: "Invalid request body format",
        });
      }

      // Handle not found
      if (code === "NOT_FOUND") {
        return status(404, {
          error: "Not Found",
          message: error instanceof Error ? error.message : "Resource not found",
        });
      }

      // Handle unauthorized
      if (code === 401) {
        return status(401, {
          error: "Unauthorized",
          message: error instanceof Error ? error.message : "Authentication required",
        });
      }

      // Handle all other errors as 500
      return status(500, {
        error: "Internal Server Error",
        message: process.env.NODE_ENV === "development" && error instanceof Error
          ? error.message
          : "An unexpected error occurred",
      });
    })
    .get("/health", async () => {
      await db.execute(sql`select 1`);
      return { status: "ok" };
    })
    .group("/api", (app) => app.all("/auth/*", betterAuthView).use(routes));

  const PORT = process.env.PORT || 3030;

  app.listen(PORT, () => {
    logger.system(
      `🚀 Server is running at ${app.server?.hostname}:${app.server?.port}`
    );
    logger.system(
      `📚 OpenAPI documentation available at ${app.server?.hostname}:${app.server?.port}/openapi`
    );
  });

  return app;
};

let appInstance: Awaited<ReturnType<typeof setupApp>> | null = null;

setupApp()
  .then((app) => {
    appInstance = app;
  })
  .catch((error) => {
    logger.exception(error, { source: "app-setup" });
    process.exit(1);
  });

const shutdown = async () => {
  logger.system("Application shutting down...");

  try {
    // Stop the Elysia app (triggers .onStop() lifecycle)
    if (appInstance) {
      await appInstance.stop();
    }

    // Stop pg-boss and LISTEN client
    await closeNotifyListener();
    await stopBoss();

    // Flush Sentry events
    if (isSentryEnabled()) {
      await flushSentry();
    }

    logger.system("Application shut down successfully");
    process.exit(0);
  } catch (error) {
    logger.exception(error, { source: "shutdown" });
    process.exit(1);
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
