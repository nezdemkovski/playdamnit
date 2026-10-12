import { siSteam } from "simple-icons";

/** The Steam logo (Simple Icons, CC0) in the current text colour */
export function SteamLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d={siSteam.path} />
    </svg>
  );
}
