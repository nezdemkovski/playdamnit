// The site's "scoreboard" look (apps/web/src/globals.css), as values an email can carry inline:
// near-black, 1px rules, zero radius, one red, labels in a monospace face. Mail clients that
// can't load the web fonts fall back to faces every system has.

export const color = {
  background: "#0f1012",
  card: "#17181b",
  foreground: "#f1f1f0",
  muted: "#9a9aa1",
  signal: "#ff2b2b",
  // --border is 14% foreground over the background; email clients need it solid
  border: "#2c2d2f",
  ink: "#000000",
} as const;

export const font = {
  sans: '"Archivo", "Helvetica Neue", Helvetica, Arial, sans-serif',
  display: '"Archivo Black", "Arial Black", Impact, "Helvetica Neue", Arial, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, Menlo, Consolas, "Courier New", monospace',
} as const;

export const siteName = "Play, damn it!";

export const tagline = "Log it. Rate it. Get judged.";

/** Where the site lives; links and the logo point here. The API passes its own URL. */
export const defaultSiteUrl = "https://games.nezdemkovski.cloud";
