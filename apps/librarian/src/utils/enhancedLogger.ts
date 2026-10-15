import winston from "winston";
import { format } from "winston";
import Transport from "winston-transport";
import * as Sentry from "@sentry/bun";
import "winston-daily-rotate-file";
import {
  LogDir,
  LogFileDatePattern,
  LogFileName,
  LogLevel as ConfigLogLevel,
  LogNamespace,
  LogRotation,
  LogTimestampFormat,
  NodeEnv,
  SentrySeverity,
  ServiceName,
} from "./enums";

const { combine, timestamp, printf, colorize, json } = format;

enum LogLevel {
  ERROR = "error",
  WARN = "warn",
  INFO = "info",
  DEBUG = "debug",
  TRACE = "silly",
  SYSTEM = "system",
}

let sentryEnabled = false;

/** Errors and job failures become Sentry issues, every log line goes to Sentry Logs */
export const initSentry = (): boolean => {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    winstonLogger.info("[Sentry] DSN not provided, error tracking is disabled");
    return false;
  }
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || NodeEnv.Development,
    release: process.env.APP_VERSION
      ? `${ServiceName.Librarian}@${process.env.APP_VERSION}`
      : undefined,
    tracesSampleRate: process.env.NODE_ENV === NodeEnv.Production ? 0.2 : 1.0,
    initialScope: { tags: { service: ServiceName.Librarian } },
  });
  sentryEnabled = true;
  process.on("uncaughtException", (error) => {
    winstonLogger.error("Uncaught exception:", { error });
    Sentry.captureException(error);
  });
  process.on("unhandledRejection", (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    winstonLogger.error("Unhandled rejection:", { error });
    Sentry.captureException(error);
  });
  return true;
};

/** Sends what is queued before the process exits */
export const flushSentry = async () => {
  if (sentryEnabled) await Sentry.close(2000);
};

/** Log lines to Sentry Logs, with their namespace and meta as attributes */
const SentryWinstonTransport = Sentry.createSentryWinstonTransport(Transport);

const consoleFormat = combine(
  colorize(),
  timestamp({ format: LogTimestampFormat.DateTime }),
  printf(({ timestamp, level, message, service, ...meta }) => {
    const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : "";
    return `[${timestamp}] [${level}] [${service || LogNamespace.Librarian}] ${message} ${metaString}`;
  }),
);

const winstonLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || ConfigLogLevel.Info,
  format: combine(timestamp(), json()),
  defaultMeta: { service: ServiceName.Librarian },
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
    }),
    new winston.transports.DailyRotateFile({
      filename: LogFileName.Error,
      datePattern: LogFileDatePattern.Daily,
      level: ConfigLogLevel.Error,
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
    // Sends nothing until Sentry is initialized
    new SentryWinstonTransport(),
  ],
});

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
        // A job's operation is a tag, so failures group and filter by queue
        const operation = typeof meta.operation === "string" ? { operation: meta.operation } : {};
        Sentry.captureException(errorObject, { tags: { namespace, ...operation }, extra: meta });
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

const defaultLogger = createLogger(LogNamespace.Librarian);
export default defaultLogger;
