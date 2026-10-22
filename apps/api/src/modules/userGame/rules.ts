import { inArray, type Column, type SQL } from "drizzle-orm";

import { UserGameStatus } from "@playdamnit/db/enums";

/** Only games the member has played can have a grade. The server owns this write invariant. */
export const canGrade = (status: UserGameStatus): boolean =>
  status !== UserGameStatus.WantToPlay && status !== UserGameStatus.Backlog;

/** The statuses that can carry a grade, in the enum's order */
export const GRADABLE_STATUSES: readonly UserGameStatus[] =
  Object.values(UserGameStatus).filter(canGrade);

/** SQL filter: the entry's status can carry a grade */
export const canGradeSql = (status: Column): SQL => inArray(status, [...GRADABLE_STATUSES]);

/** Statuses that describe a finished run, the only ones that keep an end date */
export const ENDED_STATUSES: readonly UserGameStatus[] = [
  UserGameStatus.Finished,
  UserGameStatus.Dropped,
];
