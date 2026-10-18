import { BadRequestError } from "@/utils/errors";

// Deliberately narrow: do not censor ordinary swearing or game titles. Reports and a human
// moderator handle context; this prevents clear promotion of hate/sexual exploitation.
const prohibited = [
  /\b(?:kill|exterminate)\s+(?:all\s+)?(?:jews|muslims|blacks|gays)\b/u,
  /\b(?:white\s+supremacy|heil\s+hitler|child\s+porn(?:ography)?)\b/u,
  /(?:убить|уничтожить)\s+всех\s+(?:евреев|мусульман|геев)/u,
];
export function checkPublicText(...values: (string | null | undefined)[]) {
  for (const value of values) {
    const normalized = value
      ?.normalize("NFKC")
      .replace(/[\u200b-\u200f\u2060\ufeff]/g, "")
      .toLowerCase();
    if (normalized && prohibited.some((pattern) => pattern.test(normalized))) {
      throw new BadRequestError("This content cannot be published. Check our community rules.");
    }
  }
}
