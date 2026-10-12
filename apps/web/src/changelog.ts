import { ChangeKind } from "@/lib/enums";

/**
 * What's new for members, newest release first. While the product is still taking shape every
 * new feature goes under 1.0; fixes and polish made along the way are not news and stay out.
 * Each entry says what members can now do, not how it was built.
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
        title: "Grades S to F",
        details: ["Your verdict as a seal on the cover, and a tier board on your profile"],
      },
      {
        kind: ChangeKind.New,
        title: "Steam",
        details: [
          "Sign in through Steam and your library comes in",
          "Statuses follow what you launch, hours and played days come from Steam",
          "Steam friends who are here show up on the community page",
        ],
      },
      {
        kind: ChangeKind.New,
        title: "For you: games picked from your library",
      },
      {
        kind: ChangeKind.New,
        title: "A profile that keeps score",
        details: ["Your year of play, your best games on the shelf, your most played, your badges"],
      },
      {
        kind: ChangeKind.New,
        title: "Release calendar with the releases people are waiting for",
      },
      {
        kind: ChangeKind.New,
        title: "Game pages with screenshots, trailers and the members' verdict",
      },
      {
        kind: ChangeKind.New,
        title: "Friends, reviews, lists and a journal of your playthroughs",
      },
      {
        kind: ChangeKind.New,
        title: "Steam Deck, Steam Machine and Steam Frame as platforms",
      },
    ],
  },
];
