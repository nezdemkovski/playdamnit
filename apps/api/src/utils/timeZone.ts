/** An IANA zone the runtime knows, else UTC: days are the member's own, not the server's */
export const safeZone = (tz: string | undefined) => {
  if (!tz) return "UTC";
  try {
    return new Intl.DateTimeFormat("en", { timeZone: tz }).resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
};
