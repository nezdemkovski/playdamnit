import { Grade } from "@playdamnit/api-client";

import { t } from "@/i18n";

/**
 * Grades are the only scale the UI knows. The API bands its 0–10 numbers into the letter and
 * takes a picked letter back; the UI only names and paints it.
 */
export interface GradeMeta {
  value: Grade;
  /** "Masterpiece", "Great", ... */
  name: string;
  /** The picker button when this grade is pressed */
  chip: string;
  /** The seal's colour: the TierMaker row palette, the same one the tier board uses */
  fill: string;
  /** The letter on it: one ink for every metal, the same near-black as the rim */
  ink: string;
}

export const GRADES: GradeMeta[] = [
  {
    value: Grade.S,
    get name() {
      return t("grade.names.S");
    },
    chip: "border-[#ff7f7f] bg-[#ff7f7f] text-black",
    fill: "#ff7f7f",
    ink: "var(--background)",
  },
  {
    value: Grade.A,
    get name() {
      return t("grade.names.A");
    },
    chip: "border-[#ffbf7f] bg-[#ffbf7f] text-black",
    fill: "#ffbf7f",
    ink: "var(--background)",
  },
  {
    value: Grade.B,
    get name() {
      return t("grade.names.B");
    },
    chip: "border-[#ffdf7f] bg-[#ffdf7f] text-black",
    fill: "#ffdf7f",
    ink: "var(--background)",
  },
  {
    value: Grade.C,
    get name() {
      return t("grade.names.C");
    },
    chip: "border-[#ffff7f] bg-[#ffff7f] text-black",
    fill: "#ffff7f",
    ink: "var(--background)",
  },
  {
    value: Grade.D,
    get name() {
      return t("grade.names.D");
    },
    chip: "border-[#bfff7f] bg-[#bfff7f] text-black",
    fill: "#bfff7f",
    ink: "var(--background)",
  },
  {
    value: Grade.F,
    get name() {
      return t("grade.names.F");
    },
    chip: "border-[#7fff7f] bg-[#7fff7f] text-black",
    fill: "#7fff7f",
    ink: "var(--background)",
  },
];

const BY_GRADE = new Map(GRADES.map((g) => [g.value, g]));

export const gradeMeta = (grade: Grade): GradeMeta => BY_GRADE.get(grade)!;
