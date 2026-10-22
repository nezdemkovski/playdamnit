import { UserGameStatus } from "@playdamnit/db/enums";

/** Only games the member has played can have a grade. The server owns this write invariant. */
export const canGrade = (status: UserGameStatus): boolean =>
  status !== UserGameStatus.WantToPlay && status !== UserGameStatus.Backlog;

/** The statuses that can carry a grade, in the enum's order */
export const GRADABLE_STATUSES: readonly UserGameStatus[] =
  Object.values(UserGameStatus).filter(canGrade);

/** Statuses that describe a finished run, the only ones that keep an end date */
export const ENDED_STATUSES: readonly UserGameStatus[] = [
  UserGameStatus.Finished,
  UserGameStatus.Dropped,
];
