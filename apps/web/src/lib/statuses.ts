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

import { t } from "@/i18n";

export type LibraryStatus = StatusEnum;

export interface StatusMeta {
  value: LibraryStatus;
  label: string;
  icon: LucideIcon;
  /** Tailwind colour utilities bound to the status colour tokens in globals.css */
  text: string;
  bg: string;
  border: string;
  /** The chip: finished and playing are filled, the rest are outlined in their colour */
  chip: string;
  /** Finishing dates only make sense for these */
  ended: boolean;
}

export const STATUSES: StatusMeta[] = [
  {
    value: "finished",
    get label() {
      return t("status.finished");
    },
    icon: FlagIcon,
    text: "text-status-finished",
    bg: "bg-status-finished",
    border: "border-status-finished",
    chip: "bg-status-finished border-status-finished text-black",
    ended: true,
  },
  {
    value: "playing",
    get label() {
      return t("status.playing");
    },
    icon: GamepadIcon,
    text: "text-status-playing",
    bg: "bg-status-playing",
    border: "border-status-playing",
    chip: "bg-status-playing border-status-playing text-black",
    ended: false,
  },
  {
    value: "dropped",
    get label() {
      return t("status.dropped");
    },
    icon: CircleXIcon,
    text: "text-status-dropped",
    bg: "bg-status-dropped",
    border: "border-status-dropped",
    chip: "border-status-dropped text-status-dropped",
    ended: true,
  },
  {
    value: "want_to_play",
    get label() {
      return t("status.want_to_play");
    },
    icon: SparklesIcon,
    text: "text-status-want_to_play",
    bg: "bg-status-want_to_play",
    border: "border-status-want_to_play",
    chip: "border-border text-dimmed",
    ended: false,
  },
  {
    value: "on_hold",
    get label() {
      return t("status.on_hold");
    },
    icon: PauseIcon,
    text: "text-status-on_hold",
    bg: "bg-status-on_hold",
    border: "border-status-on_hold",
    chip: "border-status-on_hold text-status-on_hold",
    ended: false,
  },
  {
    value: "backlog",
    get label() {
      return t("status.backlog");
    },
    icon: BookmarkIcon,
    text: "text-status-backlog",
    bg: "bg-status-backlog",
    border: "border-status-backlog",
    chip: "border-border text-dimmed",
    ended: false,
  },
  {
    value: "online",
    get label() {
      return t("status.online");
    },
    icon: GlobeIcon,
    text: "text-status-online",
    bg: "bg-status-online",
    border: "border-status-online",
    chip: "border-status-online text-status-online",
    ended: false,
  },
];

const BY_VALUE = new Map(STATUSES.map((s) => [s.value, s]));

export const statusMeta = (value: LibraryStatus): StatusMeta => BY_VALUE.get(value) ?? STATUSES[0];
