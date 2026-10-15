import winston from "winston";
import { format } from "winston";
import Transport from "winston-transport";
import * as Sentry from "@sentry/bun";
import "winston-daily-rotate-file";
import {
  LogDir,
  LogFileDatePattern,
  LogFileName,
  LogNamespace,
  LogRotation,
  LogTimestampFormat,
  NodeEnv,
  SentrySeverity,
  ServiceName,
} from "@/utils/enums";

const { combine, timestamp, printf, colorize, json } = format;

export enum LogLevel {
  ERROR = "error",
  WARN = "warn",
  INFO = "info",
  DEBUG = "debug",
  TRACE = "silly",
  SYSTEM = "system",
}

let sentryEnabled = false;

export const initSentry = (): boolean => {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    winstonLogger.info("[Sentry] DSN not provided, error tracking is disabled");
    sentryEnabled = false;
    return false;
  }

  try {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || NodeEnv.Development,
      // The chart passes its appVersion, so an issue names the release that brought it
      release: process.env.APP_VERSION
        ? `${ServiceName.Api}@${process.env.APP_VERSION}`
        : undefined,
      tracesSampleRate: process.env.NODE_ENV === NodeEnv.Production ? 0.2 : 1.0,
      initialScope: { tags: { service: ServiceName.Api } },
    });

    sentryEnabled = true;
    winstonLogger.info("[Sentry] Initialized successfully");

    setupGlobalErrorHandlers();

    return true;
  } catch (error) {
    winstonLogger.error("[Sentry] Failed to initialize:", error);
    sentryEnabled = false;
    return false;
  }
};

export const isSentryEnabled = (): boolean => {
  return sentryEnabled;
};

export const flushSentry = async (): Promise<boolean> => {
  if (!sentryEnabled) {
    return true;
  }

  try {
    const result = await Sentry.close(2000);
    return result;
  } catch (error) {
    winstonLogger.error("[Sentry] Error flushing events:", error);
    return false;
  }
};

/** Log lines to Sentry Logs, with their namespace and meta as attributes */
const SentryWinstonTransport = Sentry.createSentryWinstonTransport(Transport);

const consoleFormat = combine(
  colorize(),
  timestamp({ format: LogTimestampFormat.DateTime }),
  printf(({ timestamp, level, message, service, ...meta }) => {
    const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : "";
    return `[${timestamp}] [${level}] [${service || "app"}] ${message} ${metaString}`;
  }),
);

const winstonLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || LogLevel.INFO,
  format: combine(timestamp(), json()),
  defaultMeta: { service: ServiceName.Api },
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
    }),
    new winston.transports.DailyRotateFile({
      filename: LogFileName.Error,
      datePattern: LogFileDatePattern.Daily,
      level: LogLevel.ERROR,
      dirname: process.env.LOG_DIR || LogDir.Default,
      maxSize: LogRotation.MaxSize,
      maxFiles: LogRotation.MaxFiles,
      zippedArchive: true,
    }),
    new winston.transports.DailyRotateFile({
      filename: LogFileName.Combined,
      datePattern: LogFileDatePattern.Daily,
      dirname: process.env.LOG_DIR || LogDir.Default,
      maxSize: LogRotation.MaxSize,
      maxFiles: LogRotation.MaxFiles,
      zippedArchive: true,
    }),
    new winston.transports.DailyRotateFile({
      filename: LogFileName.Info,
      datePattern: LogFileDatePattern.Daily,
      level: LogLevel.INFO,
      dirname: process.env.LOG_DIR || LogDir.Default,
      maxSize: LogRotation.MaxSize,
      maxFiles: LogRotation.MaxFiles,
      zippedArchive: true,
    }),
    // Sends nothing until Sentry is initialized
    new SentryWinstonTransport(),
  ],
});

const setupGlobalErrorHandlers = () => {
  process.on("uncaughtException", (error) => {
    winstonLogger.error("Uncaught exception:", { error });
    Sentry.captureException(error);
  });

  process.on("unhandledRejection", (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    winstonLogger.error("Unhandled rejection:", { error });
    Sentry.captureException(error);
  });
};

interface EnhancedLogger {
  error: (message: string, meta?: Record<string, any>) => void;
  warn: (message: string, meta?: Record<string, any>) => void;
  info: (message: string, meta?: Record<string, any>) => void;
  debug: (message: string, meta?: Record<string, any>) => void;
  trace: (message: string, meta?: Record<string, any>) => void;
  system: (message: string, meta?: Record<string, any>) => void;
  exception: (error: unknown, meta?: Record<string, any>) => void;
  setLevel: (level: LogLevel) => void;
  level: string;
}

export const createLogger = (namespace: string): EnhancedLogger => {
  return {
    error: (message: string, meta: Record<string, any> = {}) => {
      winstonLogger.error(message, { namespace, ...meta });

      if (sentryEnabled) {
        Sentry.captureMessage(message, {
          level: SentrySeverity.Error,
          tags: { namespace },
          extra: meta,
        });
      }
    },

    // Warnings and below are only logs (Sentry Logs included), not issues
    warn: (message: string, meta: Record<string, any> = {}) => {
      winstonLogger.warn(message, { namespace, ...meta });
    },

    info: (message: string, meta: Record<string, any> = {}) => {
      winstonLogger.info(message, { namespace, ...meta });
    },

    debug: (message: string, meta: Record<string, any> = {}) => {
      winstonLogger.debug(message, { namespace, ...meta });
    },

    trace: (message: string, meta: Record<string, any> = {}) => {
      winstonLogger.silly(message, { namespace, ...meta });
    },

    system: (message: string, meta: Record<string, any> = {}) => {
      const originalLevel = winstonLogger.level;
      winstonLogger.level = "info";

      winstonLogger.info(message, {
        namespace,
        messageType: "SYSTEM",
        ...meta,
      });

      winstonLogger.level = originalLevel;
    },

    exception: (error: unknown, meta: Record<string, any> = {}) => {
      const errorObject = error instanceof Error ? error : new Error(String(error));

      winstonLogger.error(errorObject.message, {
        namespace,
        error: {
          name: errorObject.name,
          message: errorObject.message,
          stack: errorObject.stack,
        },
        ...meta,
      });

      if (sentryEnabled) {
        Sentry.captureException(errorObject, {
          tags: { namespace },
          extra: meta,
        });
      }
    },

    setLevel: (level: LogLevel) => {
      winstonLogger.level = level;
    },

    get level() {
      return winstonLogger.level;
    },

    set level(level: string) {
      winstonLogger.level = level;
    },
  };
};

const defaultLogger = createLogger(LogNamespace.App);
export default defaultLogger;
