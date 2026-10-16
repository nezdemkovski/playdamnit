import { UserGameStatus } from "@playdamnit/db/enums";

/** Only games the member has played can have a grade. The server owns this write invariant. */
export const canGrade = (status: UserGameStatus): boolean =>
  status !== UserGameStatus.WantToPlay && status !== UserGameStatus.Backlog;
