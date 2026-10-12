import { Namespace, t } from "@/i18n";
import { ChangeKind } from "@/lib/enums";

/**
 * What's new for members, newest release first. 1.0 is the first release; every new feature
 * after it gets an entry in the commit that ships it. Fixes and polish are not news and stay out.
 * Each entry says what members can now do, not how it was built. The text lives in en.json
 * (`locales/changelog/en.json`), read through getters so a language switch picks it up.
 */

export interface Change {
  kind: ChangeKind;
  title: string;
  details?: string[];
}

export interface Release {
  version: string;
  /** YYYY-MM-DD */
  date: string;
  changes: Change[];
}

export const CHANGELOG: Release[] = [
  {
    version: "1.0",
    date: "2026-10-12",
    changes: [
      {
        kind: ChangeKind.New,
        get title() {
          return t("entries.initialRelease", { ns: Namespace.Changelog });
        },
      },
    ],
  },
];
