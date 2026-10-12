import { cors } from "@elysia/cors";

import { createLogger } from "./enhancedLogger";
import { getConfig } from "@/config";
import { HttpHeader, HttpMethod, LogNamespace } from "@/utils/enums";

const logger = createLogger(LogNamespace.Cors);
const { isDev, trustedOrigins } = getConfig();

export const getCors = () => {
  if (isDev) {
    logger.system("🔓 CORS disabled for development");

    return cors({
      // Any origin, echoed back with Vary: Origin; `true` answers with Vary: *, which keeps
      // clients (URLCache on a test phone) from reusing any response
      origin: () => true,
      credentials: true,
    });
  }

  logger.system(`🔐 CORS in PROD: ${trustedOrigins}`);

  return cors({
    origin: (request) => {
      const origin = request.headers.get(HttpHeader.Origin);
      if (!origin) return false;
      return trustedOrigins.includes(origin);
    },
    credentials: true,
    allowedHeaders: [HttpHeader.ContentTypeCanonical, HttpHeader.Authorization],
    methods: Object.values(HttpMethod),
  });
};
