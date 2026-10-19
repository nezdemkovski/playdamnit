import { VerdictSource } from "@/utils/enums";
import { gradeOf, gradeOfScore } from "@/utils/grade";

const MEMBERS_VERDICT_MINIMUM = 10;

/** One product rule for every client, including community updates after a library write. */
export function verdictOf(
  overall: number | null,
  overallCount: number | null,
  average: number | null,
  count: number,
) {
  const members = gradeOf(average);
  return members && count >= MEMBERS_VERDICT_MINIMUM
    ? { source: VerdictSource.Members, grade: members, count }
    : { source: VerdictSource.Overall, grade: gradeOfScore(overall), count: overallCount ?? 0 };
}
