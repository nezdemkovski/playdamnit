import { sql, type SQL } from "drizzle-orm";

import { Grade } from "@/utils/enums";

/**
 * The one definition of the grade bands. A member's verdict is stored as a 0–10 rating and each
 * grade is a band of it (S is 9 and up, A is 8 to 9, ... F is anything above 0); the catalog's
 * 0–100 score maps the same way, ×10. Clients get the letter and only pick its colour.
 */
export const GRADE_BANDS: readonly { grade: Grade; min: number; rating: number }[] = [
  // `rating` is what a pick of the grade stores: the band's middle
  { grade: Grade.S, min: 9, rating: 9.5 },
  { grade: Grade.A, min: 8, rating: 8.5 },
  { grade: Grade.B, min: 7, rating: 7.5 },
  { grade: Grade.C, min: 6, rating: 6.5 },
  { grade: Grade.D, min: 4, rating: 5 },
  { grade: Grade.F, min: 0, rating: 2.5 },
];

const BY_GRADE = new Map(GRADE_BANDS.map((band) => [band.grade, band]));

/** The grade of a 0–10 rating; null for null and 0 (not graded) */
export const gradeOf = (rating: number | string | null | undefined): Grade | null => {
  const value = rating === null || rating === undefined ? 0 : Number(rating);
  if (!(value > 0)) return null;
  return (GRADE_BANDS.find((band) => value >= band.min) ?? GRADE_BANDS.at(-1)!).grade;
};

/** The grade of the catalog's 0–100 score */
export const gradeOfScore = (score: number | null | undefined): Grade | null =>
  score === null || score === undefined ? null : gradeOf(score / 10);

/** The rating stored for a picked grade; null clears it */
export const ratingOfGrade = (grade: Grade | null): number | null =>
  grade ? BY_GRADE.get(grade)!.rating : null;

/** The band index (0 = S) of a 0–10 rating column, null when not graded */
export const gradeIndexSql = (rating: SQL | unknown): SQL<number | null> =>
  sql`case ${sql.join(
    GRADE_BANDS.map((band, i) =>
      band.min > 0
        ? sql`when ${rating} >= ${band.min} then ${i}`
        : sql`when ${rating} > 0 then ${i}`,
    ),
    sql` `,
  )} end`;

/** One count per grade, every letter present */
export const emptyGradeCounts = (): Record<Grade, number> =>
  Object.fromEntries(GRADE_BANDS.map((band) => [band.grade, 0])) as Record<Grade, number>;
