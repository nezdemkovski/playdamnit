import { ChangeKind } from "@/lib/enums";

/**
 * What changed for people, release by release, newest first. Every release adds its entry here
 * in the same commit as the chart bump; small polish folds into the next entry that matters.
 * Written for members, not developers: what they can now do or see, not how it was built.
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
    version: "0.1.28",
    date: "2026-10-12",
    changes: [
      {
        kind: ChangeKind.Changed,
        title: "Connect Steam by signing in through Steam",
        details: [
          "No more pasting a profile link: you sign in on Steam's own page and come straight back",
          "Only the owner of a Steam account can connect it, so a Steam badge is always real",
        ],
      },
      {
        kind: ChangeKind.Fixed,
        title: "Someone else's Steam badge looked clickable even when it opened nothing",
      },
    ],
  },
  {
    version: "0.1.27",
    date: "2026-10-12",
    changes: [
      {
        kind: ChangeKind.New,
        title: "For you: games picked from your own library",
        details: [
          "Built from what you graded high, finished and played for hours on Steam",
          "Never something you already have, and no more than two games from one series",
        ],
      },
      {
        kind: ChangeKind.Changed,
        title: "The activity map moved into the profile header, with month labels",
        details: ["On phones it scrolls sideways and opens on the latest weeks"],
      },
      {
        kind: ChangeKind.Changed,
        title: "The Steam badge wears Steam's colours and your Steam avatar",
      },
      {
        kind: ChangeKind.Changed,
        title: "The profile header drops the finished progress bar",
      },
      {
        kind: ChangeKind.Fixed,
        title: "Long names and handles broke rows on the profile, community and review cards",
      },
    ],
  },
  {
    version: "0.1.26",
    date: "2026-10-12",
    changes: [
      {
        kind: ChangeKind.New,
        title: "Most played: your Steam hours on the profile",
        details: ["Hours on every game's cover in the shelf, and a sort by hours in your games"],
      },
      {
        kind: ChangeKind.Changed,
        title: "The activity map works like GitHub's",
        details: [
          "The busier the day, the redder the cell",
          "Hover a day to see what you played, added, finished or dropped",
        ],
      },
    ],
  },
  {
    version: "0.1.25",
    date: "2026-10-12",
    changes: [
      {
        kind: ChangeKind.New,
        title: "Steam keeps your statuses honest",
        details: [
          "Launched in the last two weeks moves a game to Playing",
          "Idle days count from your last launch on Steam",
          "Days you played show up on the activity map",
        ],
      },
      {
        kind: ChangeKind.New,
        title: "Steam friends who are here show up on the community page",
      },
    ],
  },
  {
    version: "0.1.24",
    date: "2026-10-12",
    changes: [
      {
        kind: ChangeKind.New,
        title: "Connect your Steam account",
        details: [
          "Your Steam library comes in on PC: never launched goes to the backlog, played to on hold",
          "New games arrive on their own every few hours, or right away with Sync now",
        ],
      },
    ],
  },
  {
    version: "0.1.23",
    date: "2026-10-12",
    changes: [
      {
        kind: ChangeKind.Changed,
        title: "Hot releases are the ones people are waiting for",
      },
      {
        kind: ChangeKind.Changed,
        title: "Calendar days list games without rating counts",
      },
    ],
  },
  {
    version: "0.1.22",
    date: "2026-10-12",
    changes: [
      {
        kind: ChangeKind.New,
        title: "A media viewer for screenshots, trailers and covers",
      },
      {
        kind: ChangeKind.Changed,
        title: "Game rows scroll with a trackpad or a drag, and fade at the edges",
      },
      {
        kind: ChangeKind.Changed,
        title: "The release calendar shows how many games come out each day",
        details: ["Open a day to see all of them"],
      },
    ],
  },
  {
    version: "0.1.21",
    date: "2026-10-12",
    changes: [
      {
        kind: ChangeKind.New,
        title: "Grades are seals now",
        details: [
          "S to F in tier list colours, stuck on covers, reviews and the game page",
          "A game shows the members' verdict once ten people graded it, the overall one before that",
        ],
      },
      {
        kind: ChangeKind.Changed,
        title: "A new profile header",
        details: [
          "Your best games on the shelf, what you finished, your typical grade and your badges",
          "The tier board sits right under the tabs",
        ],
      },
    ],
  },
  {
    version: "0.1.14",
    date: "2026-10-11",
    changes: [
      {
        kind: ChangeKind.New,
        title: "A tier board on your profile",
        details: ["Drag games into rows, or pick a game and tap a tier"],
      },
    ],
  },
  {
    version: "0.1.13",
    date: "2026-10-11",
    changes: [
      {
        kind: ChangeKind.Changed,
        title: "Grades S to F replace the 0–10 rating",
      },
    ],
  },
  {
    version: "0.1.12",
    date: "2026-10-11",
    changes: [
      {
        kind: ChangeKind.Changed,
        title: "The release calendar is a month grid",
      },
    ],
  },
  {
    version: "0.1.11",
    date: "2026-10-11",
    changes: [
      {
        kind: ChangeKind.Changed,
        title: "The scoreboard look",
        details: ["Near-black, hairline rules, one red, and copy that keeps score"],
      },
    ],
  },
  {
    version: "0.1.10",
    date: "2026-10-11",
    changes: [
      {
        kind: ChangeKind.New,
        title: "Steam Deck, Steam Machine and Steam Frame as platforms",
      },
    ],
  },
  {
    version: "0.1.9",
    date: "2026-10-11",
    changes: [
      {
        kind: ChangeKind.New,
        title: "Change your email or delete your account from settings",
      },
    ],
  },
  {
    version: "0.1.8",
    date: "2026-10-11",
    changes: [
      {
        kind: ChangeKind.New,
        title: "The social layer",
        details: [
          "Follow people, see what your friends play, react to reviews",
          "Lists, a journal of playthroughs and a community page",
        ],
      },
    ],
  },
  {
    version: "0.1.7",
    date: "2026-10-11",
    changes: [
      {
        kind: ChangeKind.Fixed,
        title: "Search finds exact names first, alternative names too, in any alphabet",
      },
    ],
  },
];
