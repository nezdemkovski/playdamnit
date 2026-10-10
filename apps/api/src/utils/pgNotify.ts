import { Client } from "pg";

import { NOTIFY_CHANNEL, type CatalogUpdatedPayload } from "@playdamnit/db/jobs";
import { createLogger } from "@/utils/enhancedLogger";

const logger = createLogger("pg-notify");

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

export type NotifyResult = "notified" | "failed" | "timeout";

// pending: requestId → resolve fn
const pending = new Map<string, (result: NotifyResult) => void>();
let listenClient: Client | null = null;
let stopped = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;

const handleNotification = (payload?: string) => {
  if (!payload) return;
  try {
    const { requestId, ok } = JSON.parse(payload) as CatalogUpdatedPayload;
    const resolve = pending.get(requestId);
    if (resolve) {
      pending.delete(requestId);
      resolve(ok === false ? "failed" : "notified");
    }
  } catch {
    // ignore malformed payloads
  }
};

const scheduleReconnect = () => {
  if (stopped || reconnectTimer) return;

  const delay = Math.min(1000 * 2 ** reconnectAttempt, MAX_RECONNECT_DELAY_MS);
  reconnectAttempt++;

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect().catch((error) => {
      logger.error(`LISTEN reconnect failed: ${error.message}`);
      scheduleReconnect();
    });
  }, delay);
};

const connect = async (): Promise<void> => {
  const client = new Client(process.env.POSTGRES_URL);

  // "error" and "end" can both fire for one failure; only the current client may trigger a reconnect
  const onLost = (reason: string) => {
    if (listenClient !== client) return;
    listenClient = null;
    logger.error(`LISTEN client lost: ${reason}`);
    client.end().catch(() => {});
    scheduleReconnect();
  };

  client.on("notification", (msg) => handleNotification(msg.payload));
  client.on("error", (error) => onLost(error.message));
  client.on("end", () => onLost("connection ended"));

  try {
    await client.connect();
    await client.query(`LISTEN ${NOTIFY_CHANNEL}`);
  } catch (error) {
    client.end().catch(() => {});
    throw error;
  }

  listenClient = client;
  reconnectAttempt = 0;
  logger.system(`LISTEN established on channel: ${NOTIFY_CHANNEL}`);
};

export const initNotifyListener = async (): Promise<void> => {
  stopped = false;
  await connect();
};

export const waitForNotify = (
  requestId: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<NotifyResult> => {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(requestId);
      resolve("timeout"); // fall through to the PG query anyway
    }, timeoutMs);

    pending.set(requestId, (result) => {
      clearTimeout(timer);
      resolve(result);
    });
  });
};

export const closeNotifyListener = async (): Promise<void> => {
  stopped = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  const client = listenClient;
  listenClient = null;
  if (client) {
    await client.end();
  }
};
