import type { Job } from "pg-boss";

import logger from "../utils/enhancedLogger";

/**
 * A job handler whose failure is logged and reported (Sentry tags it with the queue) before it
 * is rethrown for pg-boss to retry
 */
export const reported =
  <T, R>(queue: string, handler: (jobs: Job<T>[]) => Promise<R>) =>
  async (jobs: Job<T>[]): Promise<R> => {
    try {
      return await handler(jobs);
    } catch (error) {
      logger.exception(error, { operation: queue, jobIds: jobs.map((job) => job.id) });
      throw error;
    }
  };
