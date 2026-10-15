import {
  Grade as GradeEnum,
  StatusEnum,
  type Game,
  type UserGameData,
} from "@playdamnit/api-client";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDownIcon, Trash2Icon } from "lucide-react";
import { cn } from "cn";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Playthroughs } from "./playthroughs";
import { useSession } from "@/hooks/auth";
import { usePlayPlatforms } from "@/hooks/platforms";
import { useLibraryMutations, useMyEntry } from "@/hooks/library";
import { GradeBadge } from "./rating";
import { PillSize } from "@/lib/enums";
import { GRADES, gradeMeta } from "@/lib/grade";
import { STATUSES, statusMeta, type LibraryStatus } from "@/lib/statuses";
import { GameCover } from "./game-cover";

const MAX_REVIEW = 5000;

/** What the caller knows of the viewer's entry: an index item's or a full one */
export type KnownEntry = Pick<UserGameData, "status" | "grade">;

interface LogGameDialogProps {
  game: Pick<Game, "id" | "name" | "cover" | "platforms" | "firstReleaseDate">;
  /** The entry, if the game is in the list; the dialog loads it in full (review included) */
  entry?: KnownEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const toDateInput = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "");

/**
 * Add a game to the list or edit the existing entry: rating slider, status, platform,
 * finish date and a review. Mirrors the reference "Add game" sheet.
 */
export function LogGameDialog({ game, entry, open, onOpenChange }: LogGameDialogProps) {
  const { t } = useTranslation();
  const { user } = useSession();
  const navigate = useNavigate();
  const library = useLibraryMutations();
  const platforms = usePlayPlatforms(game.platforms);
  // Editing starts from the entry in full: lookups only carry whether there is a review
  const editing = !!entry;
  const full = useMyEntry(game.id, open && editing);
  const current = editing ? (full.data?.userGameData ?? null) : null;
  const ready = !editing || !!current;
  const filled = useRef(false);

  const [grade, setGrade] = useState<GradeEnum | null>(null);
  // Bumped on every pick so the seal's animation restarts; 0 means "no moment yet"
  const [moment, setMoment] = useState(0);
  const [status, setStatus] = useState<LibraryStatus>(StatusEnum.WantToPlay);
  const [platformId, setPlatformId] = useState<string>("");
  const [endedAt, setEndedAt] = useState("");
  const [review, setReview] = useState("");
  const [mastered, setMastered] = useState(false);
  const [spoilers, setSpoilers] = useState(false);
  const [allowReactions, setAllowReactions] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Reset the form from the entry once per opening, as soon as it is there; a refetch while
  // the dialog is open must not wipe what is being typed
  useEffect(() => {
    if (!open) {
      filled.current = false;
      return;
    }
    if (!ready || filled.current) return;
    filled.current = true;
    setGrade(current?.grade ?? null);
    setMoment(0);
    setStatus(current?.status ?? StatusEnum.WantToPlay);
    setPlatformId(String(current?.platformId ?? game.platforms[0]?.id ?? ""));
    setEndedAt(toDateInput(current?.endedAt));
    setReview(current?.review ?? "");
    setMastered(current?.mastered ?? false);
    setSpoilers(current?.spoilers ?? false);
    setAllowReactions(current?.allowReactions ?? true);
    setDetailsOpen(!!current?.endedAt || !!current?.mastered);
  }, [open, ready, current, game.platforms]);

  if (open && !user) {
    onOpenChange(false);
    navigate({ to: "/auth" });
    return null;
  }

  const showEnded = statusMeta(status).ended;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const platform = platformId ? Number(platformId) : null;
    if (!platform) return;
    const trimmed = review.trim();
    const ended = showEnded && endedAt ? endedAt : null;
    const common = {
      status,
      grade,
      platformId: platform,
      mastered,
      spoilers,
      allowReactions,
    };
    try {
      if (entry) {
        // null clears a previously set date
        await library.update(game.id, { ...common, endedAt: ended, review: trimmed || null });
      } else {
        await library.add({
          gameId: game.id,
          ...common,
          // Creating accepts only a date string; the API wants ≥ 3 characters for a review
          ...(ended && { endedAt: ended }),
          ...(trimmed.length >= 3 && { review: trimmed }),
        });
      }
      onOpenChange(false);
    } catch {
      // The mutation hooks already toast the error; keep the dialog open to retry
    }
  };

  const remove = async () => {
    try {
      await library.remove(game.id);
      onOpenChange(false);
    } catch {
      // toasted by the hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-card border-white/5 bg-popover p-6 sm:max-w-xl">
        <DialogHeader className="flex-row items-center gap-5 text-left">
          <div className="relative mr-3 w-20 shrink-0" key={moment}>
            <GameCover url={game.cover?.url} name={game.name} />
            {grade && (
              <GradeBadge
                grade={grade}
                size={PillSize.Lg}
                pressed={moment > 0}
                className="absolute -right-4 -bottom-3"
              />
            )}
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-xl font-bold">{game.name}</DialogTitle>
            <DialogDescription>{entry ? t("log.editEntry") : t("log.addToList")}</DialogDescription>
          </div>
        </DialogHeader>

        {!ready &&
          (full.isError ? (
            <p className="mt-2 text-sm text-dimmed">{t("log.loadFailed")}</p>
          ) : (
            <Skeleton className="mt-2 h-96" />
          ))}
        <form onSubmit={submit} className={cn("mt-2 space-y-6", !ready && "hidden")}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t("log.grade")}</Label>
              <span className="text-xs text-dimmed">{grade ? gradeMeta(grade).name : ""}</span>
            </div>
            <div className="grid grid-cols-6 gap-1.5" role="radiogroup" aria-label={t("log.grade")}>
              {GRADES.map((g) => {
                const active = g.value === grade;
                return (
                  <button
                    key={g.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    title={g.name}
                    onClick={() => {
                      setGrade(active ? null : g.value);
                      setMoment(active ? 0 : moment + 1);
                    }}
                    className={cn(
                      "num flex h-12 items-center justify-center border text-2xl font-extrabold transition-colors",
                      active
                        ? g.chip
                        : "border-border text-dimmed hover:bg-white/[0.05] hover:text-foreground",
                    )}
                  >
                    {g.value}
                  </button>
                );
              })}
            </div>
            <div className="min-h-10 text-sm">
              {grade ? (
                <>
                  <div className="font-bold">{t(`grade.lines.${grade}.main`)}</div>
                  <div className="text-xs text-dimmed">{t(`grade.lines.${grade}.sub`)}</div>
                </>
              ) : (
                <div className="text-xs text-dimmed">{t("log.noGrade")}</div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <Label>{t("log.status")}</Label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {STATUSES.map((s) => {
                const Icon = s.icon;
                const active = s.value === status;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setStatus(s.value)}
                    aria-pressed={active}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-sm font-semibold transition-colors",
                      active
                        ? cn("border-transparent text-black", s.bg)
                        : "border-white/10 bg-white/[0.03] text-foreground hover:bg-white/[0.07]",
                    )}
                  >
                    {s.label}
                    <Icon className="size-3.5" strokeWidth={2.5} />
                  </button>
                );
              })}
            </div>
          </div>

          <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
            <CollapsibleTrigger className="flex items-center gap-1 text-sm font-semibold">
              {t("log.details")}
              <ChevronDownIcon
                className={cn("size-4 transition-transform", detailsOpen && "rotate-180")}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="platform">{t("log.platform")}</Label>
                <Select value={platformId} onValueChange={setPlatformId}>
                  <SelectTrigger id="platform" className="w-full">
                    <SelectValue placeholder={t("log.pickPlatform")} />
                  </SelectTrigger>
                  <SelectContent>
                    {platforms.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {showEnded && (
                <div className="space-y-2">
                  <Label htmlFor="endedAt">
                    {status === StatusEnum.Dropped ? t("log.droppedOn") : t("log.finishedOn")}
                  </Label>
                  <Input
                    id="endedAt"
                    type="date"
                    value={endedAt}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setEndedAt(e.target.value)}
                  />
                </div>
              )}
              <div className="flex items-center gap-3 sm:col-span-2">
                <Switch id="mastered" checked={mastered} onCheckedChange={setMastered} />
                <Label htmlFor="mastered">{t("log.mastered")}</Label>
              </div>
              {current && user?.username && (
                <div className="sm:col-span-2">
                  <Playthroughs
                    username={user.username}
                    gameId={game.id}
                    platforms={platforms}
                    defaultPlatformId={current.platformId}
                  />
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          <div className="space-y-2">
            <Label htmlFor="review">{t("log.review")}</Label>
            <Textarea
              id="review"
              value={review}
              onChange={(e) => setReview(e.target.value.slice(0, MAX_REVIEW))}
              placeholder={t("log.reviewPlaceholder", { max: MAX_REVIEW })}
              className="min-h-28"
            />
            <div className="flex items-center justify-between gap-3 text-xs text-dimmed">
              <span>{t("log.markdownHint")}</span>
              <span>
                {review.length} / {MAX_REVIEW}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="spoilers" checked={spoilers} onCheckedChange={setSpoilers} />
              <Label htmlFor="spoilers">{t("log.spoilers")}</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="allow-reactions"
                checked={allowReactions}
                onCheckedChange={setAllowReactions}
              />
              <Label htmlFor="allow-reactions">{t("log.allowReactions")}</Label>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            {entry ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2Icon /> {t("log.remove")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-card">
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("log.removeTitle", { name: game.name })}</AlertDialogTitle>
                    <AlertDialogDescription>{t("log.removeText")}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("common.keep")}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={remove}
                      className="bg-destructive text-white hover:bg-destructive/90"
                    >
                      {t("log.remove")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <span />
            )}
            <Button type="submit" size="lg" disabled={library.isPending || !platformId}>
              {entry ? t("common.save") : t("log.add")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
