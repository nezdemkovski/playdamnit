import { t } from "@/i18n";
import { Grade } from "@/lib/enums";

/**
 * Grades are the only scale the UI knows. The API keeps a 0–10 number, so each grade is a
 * band of it (S is 9 and up, A is 8 to 9, ...) and writes land on the band's middle.
 */
export interface GradeMeta {
  value: Grade;
  /** "Masterpiece", "Great", ... */
  name: string;
  /** Lowest rating that still counts as this grade */
  min: number;
  /** The rating the API gets when a member picks this grade */
  rating: number;
  /** The picker button when this grade is pressed */
  chip: string;
  /** The seal's metal: platinum, gold, silver, bronze, iron, red */
  fill: string;
  /** The letter on it */
  ink: string;
}

export const GRADES: GradeMeta[] = [
  {
    value: Grade.S,
    get name() {
      return t("grade.names.S");
    },
    min: 9,
    rating: 9.5,
    chip: "border-[#dcf1ff] bg-[#dcf1ff] text-black",
    fill: "#dcf1ff",
    ink: "#000",
  },
  {
    value: Grade.A,
    get name() {
      return t("grade.names.A");
    },
    min: 8,
    rating: 8.5,
    chip: "border-[#ffcf4a] bg-[#ffcf4a] text-black",
    fill: "#ffcf4a",
    ink: "#000",
  },
  {
    value: Grade.B,
    get name() {
      return t("grade.names.B");
    },
    min: 7,
    rating: 7.5,
    chip: "border-[#cfd3d8] bg-[#cfd3d8] text-black",
    fill: "#cfd3d8",
    ink: "#000",
  },
  {
    value: Grade.C,
    get name() {
      return t("grade.names.C");
    },
    min: 6,
    rating: 6.5,
    chip: "border-[#d9975f] bg-[#d9975f] text-black",
    fill: "#d9975f",
    ink: "#000",
  },
  {
    value: Grade.D,
    get name() {
      return t("grade.names.D");
    },
    min: 4,
    rating: 5,
    chip: "border-[#6f7077] bg-[#6f7077] text-white",
    fill: "#6f7077",
    ink: "#fff",
  },
  {
    value: Grade.F,
    get name() {
      return t("grade.names.F");
    },
    min: 0,
    rating: 2.5,
    chip: "border-signal bg-signal text-black",
    fill: "#ff2b2b",
    ink: "#000",
  },
];

const BY_GRADE = new Map(GRADES.map((g) => [g.value, g]));

export const gradeMeta = (grade: Grade): GradeMeta => BY_GRADE.get(grade)!;

/** The grade of a 0–10 rating; nothing for 0, null or undefined (not graded) */
export const gradeOf = (rating: number | null | undefined): Grade | null => {
  if (!rating || rating <= 0) return null;
  return (GRADES.find((g) => rating >= g.min) ?? GRADES[GRADES.length - 1]).value;
};

/** The grade of an IGDB 0–100 score */
export const gradeOfPercent = (score: number | null | undefined): Grade | null =>
  gradeOf(score ? score / 10 : null);

/** The rating the API stores for a grade (0 clears it) */
export const ratingOf = (grade: Grade | null): number => (grade ? gradeMeta(grade).rating : 0);

/** Fold the API's ten whole-number buckets into one count per grade, in GRADES order */
export const gradeBuckets = (histogram: number[]): number[] => {
  const counts = GRADES.map(() => 0);
  histogram.forEach((n, i) => {
    const grade = gradeOf(i + 1);
    if (grade) counts[GRADES.findIndex((g) => g.value === grade)] += n;
  });
  return counts;
};

/** One count per grade for a set of ratings */
export const gradeCounts = (ratings: (number | null | undefined)[]): number[] => {
  const counts = GRADES.map(() => 0);
  for (const r of ratings) {
    const grade = gradeOf(r);
    if (grade) counts[GRADES.findIndex((g) => g.value === grade)]++;
  }
  return counts;
};
