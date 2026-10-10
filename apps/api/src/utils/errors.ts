/**
 * Base application error class. Services throw these; the global onError
 * handler in src/index.ts turns them into `{ error, message }` responses.
 */
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly errorType: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 404 Not Found error
 */
export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly errorType = "Not Found";

  constructor(message: string = "Resource not found") {
    super(message);
  }
}

/**
 * 400 Bad Request error
 */
export class BadRequestError extends AppError {
  readonly statusCode = 400;
  readonly errorType = "Bad Request";

  constructor(message: string = "Bad request") {
    super(message);
  }
}

/**
 * 403 Forbidden error
 */
export class ForbiddenError extends AppError {
  readonly statusCode = 403;
  readonly errorType = "Forbidden";

  constructor(message: string = "Forbidden") {
    super(message);
  }
}

/**
 * 409 Conflict error
 */
export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly errorType = "Conflict";

  constructor(message: string = "Conflict") {
    super(message);
  }
}

/**
 * 429 Too Many Requests error
 */
export class TooManyRequestsError extends AppError {
  readonly statusCode = 429;
  readonly errorType = "Too Many Requests";

  constructor(
    message: string = "Too many requests",
    readonly retryAfterSeconds?: number
  ) {
    super(message);
  }
}

/**
 * 500 Internal Server Error
 */
export class InternalServerError extends AppError {
  readonly statusCode = 500;
  readonly errorType = "Internal Server Error";

  constructor(message: string = "Internal server error") {
    super(message);
  }
}

/**
 * 503 Service Unavailable error
 */
export class ServiceUnavailableError extends AppError {
  readonly statusCode = 503;
  readonly errorType = "Service Unavailable";

  constructor(message: string = "Service unavailable") {
    super(message);
  }
}
