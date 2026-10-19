import { BadRequestError } from "@/utils/errors";

/** The member's calendar day, computed by the API rather than the device clock. */
export function todayIn(timeZone: string, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    throw new BadRequestError("Invalid time zone");
  }
}
