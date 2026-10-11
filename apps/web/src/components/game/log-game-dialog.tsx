import type { Game, UserGameData } from "@playdamnit/api-client";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDownIcon, Trash2Icon } from "lucide-react";
import { cn } from "cn";
import { useEffect, useState } from "react";

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
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Playthroughs } from "./playthroughs";
import { useSession } from "@/hooks/auth";
import { usePlayPlatforms } from "@/hooks/platforms";
import { useLibraryMutations } from "@/hooks/library";
import { formatRating, ratingColor } from "@/lib/format";
import { STATUSES, statusMeta, type LibraryStatus } from "@/lib/statuses";
import { GameCover } from "./game-cover";

const MAX_REVIEW = 5000;

interface LogGameDialogProps {
  game: Pick<Game, "id" | "name" | "cover" | "platforms" | "firstReleaseDate">;
  entry?: UserGameData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const toDateInput = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "");

/**
 * Add a game to the list or edit the existing entry: rating slider, status, platform,
 * finish date and a review. Mirrors the reference "Add game" sheet.
 */
export function LogGameDialog({ game, entry, open, onOpenChange }: LogGameDialogProps) {
  const { user } = useSession();
  const navigate = useNavigate();
  const library = useLibraryMutations();
  const platforms = usePlayPlatforms(game.platforms);

  const [rating, setRating] = useState(0);
  const [status, setStatus] = useState<LibraryStatus>("want_to_play");
  const [platformId, setPlatformId] = useState<string>("");
  const [endedAt, setEndedAt] = useState("");
  const [review, setReview] = useState("");
  const [mastered, setMastered] = useState(false);
  const [spoilers, setSpoilers] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Reset the form from the entry every time the dialog opens
  useEffect(() => {
    if (!open) return;
    setRating(entry?.rating ?? 0);
    setStatus(entry?.status ?? "want_to_play");
    setPlatformId(String(entry?.platformId ?? game.platforms[0]?.id ?? ""));
    setEndedAt(toDateInput(entry?.endedAt));
    setReview(entry?.review ?? "");
    setMastered(entry?.mastered ?? false);
    setSpoilers(entry?.spoilers ?? false);
    setDetailsOpen(!!entry?.endedAt || !!entry?.mastered);
  }, [open, entry, game.platforms]);

  if (open && !user) {
    onOpenChange(false);
    navigate({ to: "/auth" });
    return null;
  }

  const showEnded = statusMeta(status).ended;
  const ratingText = formatRating(rating);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const platform = platformId ? Number(platformId) : null;
    if (!platform) return;
    const trimmed = review.trim();
    const ended = showEnded && endedAt ? endedAt : null;
    const common = { status, rating, platformId: platform, mastered, spoilers };
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
        <DialogHeader className="flex-row items-center gap-4 text-left">
          <GameCover url={game.cover?.url} name={game.name} className="w-16 shrink-0" />
          <div className="min-w-0">
            <DialogTitle className="text-xl font-bold">{game.name}</DialogTitle>
            <DialogDescription>{entry ? "Edit your entry" : "Add to your list"}</DialogDescription>
          </div>
        </DialogHeader>

        <form onSubmit={submit} className="mt-2 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Your rating</Label>
              <span
                className={cn(
                  "text-2xl font-bold tabular-nums",
                  rating ? ratingColor(rating) : "text-dimmed",
                )}
              >
                {ratingText ?? "–"}
              </span>
            </div>
            <Slider
              value={[rating]}
              onValueChange={([value]) => setRating(value)}
              min={0}
              max={10}
              step={0.1}
              aria-label="Rating"
            />
            <div className="flex justify-between text-xs text-dimmed">
              <span>Not rated</span>
              <span>10</span>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Status</Label>
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
              Details
              <ChevronDownIcon
                className={cn("size-4 transition-transform", detailsOpen && "rotate-180")}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="platform">Platform</Label>
                <Select value={platformId} onValueChange={setPlatformId}>
                  <SelectTrigger id="platform" className="w-full">
                    <SelectValue placeholder="Pick a platform" />
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
                    {status === "dropped" ? "Dropped on" : "Finished on"}
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
                <Label htmlFor="mastered">Mastered (100%, platinum, true ending)</Label>
              </div>
              {entry && user?.username && (
                <div className="sm:col-span-2">
                  <Playthroughs
                    username={user.username}
                    gameId={game.id}
                    platforms={platforms}
                    defaultPlatformId={entry.platformId}
                  />
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          <div className="space-y-2">
            <Label htmlFor="review">Review</Label>
            <Textarea
              id="review"
              value={review}
              onChange={(e) => setReview(e.target.value.slice(0, MAX_REVIEW))}
              placeholder={`Write your review in less than ${MAX_REVIEW} characters…`}
              className="min-h-28"
            />
            <div className="flex items-center justify-between gap-3 text-xs text-dimmed">
              <span>Markdown works: **bold**, *italic*, [links](url), lists.</span>
              <span>
                {review.length} / {MAX_REVIEW}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="spoilers" checked={spoilers} onCheckedChange={setSpoilers} />
              <Label htmlFor="spoilers">Contains spoilers</Label>
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
                    <Trash2Icon /> Remove
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-card">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove {game.name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Your rating, status and review for this game will be deleted.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={remove}
                      className="bg-destructive text-white hover:bg-destructive/90"
                    >
                      Remove
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <span />
            )}
            <Button type="submit" size="lg" disabled={library.isPending || !platformId}>
              {entry ? "Save" : "Add game"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
