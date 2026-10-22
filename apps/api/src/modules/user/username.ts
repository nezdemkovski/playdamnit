import { inArray } from "drizzle-orm";

import { db as postgresDb } from "@/db/postgres";
import { user } from "@playdamnit/db/schema";
import { UsernameProblem } from "@/utils/enums";

// The one copy of the username rule; Better Auth's username plugin is configured from it too
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
const USERNAME_CHARS = /^[a-zA-Z0-9_.]+$/;

export const isValidUsername = (name: string) =>
  name.length >= USERNAME_MIN && name.length <= USERNAME_MAX && USERNAME_CHARS.test(name);

const SUGGESTIONS = 3;
// Room for the longest ending a suggestion adds ("_123")
const SUGGESTION_BASE = USERNAME_MAX - 4;

const problemOf = (name: string): UsernameProblem | null => {
  if (name.length < USERNAME_MIN) return UsernameProblem.TooShort;
  if (name.length > USERNAME_MAX) return UsernameProblem.TooLong;
  if (!USERNAME_CHARS.test(name)) return UsernameProblem.Characters;
  return null;
};

const randomInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

/** Names close to a taken one, most like it first */
const candidatesFor = (name: string): string[] => {
  const base = name.slice(0, SUGGESTION_BASE);
  return [
    ...new Set([
      `${base}_`,
      base.includes("_") ? base.replaceAll("_", ".") : `${base}.gg`,
      `${base}${randomInt(2, 99)}`,
      `${base}_${randomInt(100, 999)}`,
      `the.${base}`,
      `${base}.${randomInt(2, 99)}`,
      `real.${base}`,
      `${base}${randomInt(100, 9999)}`,
    ]),
  ].filter(isValidUsername);
};

/** Which of these names are taken; Better Auth stores usernames lowercase (on the unique index) */
const takenAmong = async (names: string[]) => {
  const rows = await postgresDb
    .select({ username: user.username })
    .from(user)
    .where(
      inArray(
        user.username,
        names.map((n) => n.toLowerCase()),
      ),
    );
  return new Set(rows.map((r) => r.username?.toLowerCase()));
};

/**
 * Whether a username can be had, in one call: the rule, whether it is free (the viewer's own
 * name counts as free) and, when it is taken, a few free names made from it
 */
export const checkUsername = async (raw: string, viewerUsername: string | null) => {
  const username = raw.trim();
  // The rule's bounds, so clients can word `reason` without a copy of the numbers
  const rule = { minLength: USERNAME_MIN, maxLength: USERNAME_MAX };
  const problem = problemOf(username);
  if (problem) {
    return { username, valid: false, available: false, reason: problem, suggestions: [], ...rule };
  }
  if (viewerUsername && username.toLowerCase() === viewerUsername.toLowerCase()) {
    return { username, valid: true, available: true, reason: null, suggestions: [], ...rule };
  }
  const candidates = candidatesFor(username);
  const taken = await takenAmong([username, ...candidates]);
  const available = !taken.has(username.toLowerCase());
  return {
    username,
    valid: true,
    available,
    reason: available ? null : UsernameProblem.Taken,
    suggestions: available
      ? []
      : candidates.filter((c) => !taken.has(c.toLowerCase())).slice(0, SUGGESTIONS),
    ...rule,
  };
};
