import type { StatusEnum } from "@playdamnit/api-client";
import {
  BookmarkIcon,
  CircleXIcon,
  FlagIcon,
  GamepadIcon,
  GlobeIcon,
  PauseIcon,
  SparklesIcon,
  type LucideIcon,
} from "lucide-react";

export type LibraryStatus = StatusEnum;

export interface StatusMeta {
  value: LibraryStatus;
  label: string;
  icon: LucideIcon;
  /** Tailwind colour utilities bound to the status colour tokens in globals.css */
  text: string;
  bg: string;
  border: string;
  /** Finishing dates only make sense for these */
  ended: boolean;
}

export const STATUSES: StatusMeta[] = [
  {
    value: "finished",
    label: "Finished",
    icon: FlagIcon,
    text: "text-status-finished",
    bg: "bg-status-finished",
    border: "border-status-finished",
    ended: true,
  },
  {
    value: "playing",
    label: "Playing",
    icon: GamepadIcon,
    text: "text-status-playing",
    bg: "bg-status-playing",
    border: "border-status-playing",
    ended: false,
  },
  {
    value: "dropped",
    label: "Dropped",
    icon: CircleXIcon,
    text: "text-status-dropped",
    bg: "bg-status-dropped",
    border: "border-status-dropped",
    ended: true,
  },
  {
    value: "want_to_play",
    label: "Want",
    icon: SparklesIcon,
    text: "text-status-want_to_play",
    bg: "bg-status-want_to_play",
    border: "border-status-want_to_play",
    ended: false,
  },
  {
    value: "on_hold",
    label: "On hold",
    icon: PauseIcon,
    text: "text-status-on_hold",
    bg: "bg-status-on_hold",
    border: "border-status-on_hold",
    ended: false,
  },
  {
    value: "backlog",
    label: "Backlog",
    icon: BookmarkIcon,
    text: "text-status-backlog",
    bg: "bg-status-backlog",
    border: "border-status-backlog",
    ended: false,
  },
  {
    value: "online",
    label: "Online",
    icon: GlobeIcon,
    text: "text-status-online",
    bg: "bg-status-online",
    border: "border-status-online",
    ended: false,
  },
];

const BY_VALUE = new Map(STATUSES.map((s) => [s.value, s]));

export const statusMeta = (value: LibraryStatus): StatusMeta => BY_VALUE.get(value) ?? STATUSES[0];
