import { useGetApiGamesSearch } from "@playdamnit/api-client";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRightIcon, Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GameCover } from "@/components/game/game-cover";
import { useDebounced } from "@/hooks/debounced";
import { releaseYear } from "@/lib/format";
import { IgdbSize } from "@/lib/enums";

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** ⌘K search over the catalog; picking a result opens its page */
export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const q = useDebounced(query.trim(), 250);
  const enabled = q.length >= 2;

  const { data, isFetching } = useGetApiGamesSearch(
    { q, limit: 10 },
    { query: { enabled, placeholderData: (prev) => prev } },
  );
  const results = enabled ? (data?.results ?? []) : [];

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const go = (to: () => void) => {
    onOpenChange(false);
    to();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-[12%] translate-y-0 overflow-hidden rounded-card border-white/5 bg-popover p-0 sm:max-w-xl"
        showCloseButton={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{t("layout.searchDialog.title")}</DialogTitle>
          <DialogDescription>{t("layout.searchDialog.description")}</DialogDescription>
        </DialogHeader>
        {/* The API already ranks the results; cmdk must not filter them again */}
        <Command
          shouldFilter={false}
          className="bg-transparent **:data-[slot=command-input-wrapper]:h-14 [&_[cmdk-input]]:h-14 [&_[cmdk-input]]:text-base"
        >
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={t("layout.searchDialog.placeholder")}
          />
          <CommandList className="max-h-[60dvh]">
            {enabled && !isFetching && results.length === 0 && (
              <CommandEmpty>{t("layout.searchDialog.empty")}</CommandEmpty>
            )}
            {!enabled && (
              <div className="py-8 text-center text-sm text-dimmed">
                {t("layout.searchDialog.hint")}
              </div>
            )}
            {isFetching && results.length === 0 && (
              <div className="flex justify-center py-8 text-dimmed">
                <Loader2Icon className="size-5 animate-spin" />
              </div>
            )}
            {results.length > 0 && (
              <CommandGroup heading={t("layout.searchDialog.group")}>
                {results.map((game) => (
                  <CommandItem
                    key={game.id}
                    value={String(game.id)}
                    onSelect={() =>
                      go(() => navigate({ to: "/games/$id", params: { id: String(game.id) } }))
                    }
                    className="gap-3 rounded-lg px-2 py-2"
                  >
                    <GameCover
                      url={game.cover?.url}
                      name={game.name}
                      size={IgdbSize.CoverSmall}
                      className="w-9 shrink-0 rounded-md"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{game.name}</div>
                      <div className="truncate text-xs text-dimmed">
                        {[
                          releaseYear(game.firstReleaseDate),
                          game.platforms
                            .map((p) => p.abbreviation ?? p.name)
                            .slice(0, 4)
                            .join(", "),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                  </CommandItem>
                ))}
                <CommandItem
                  value="__all__"
                  onSelect={() =>
                    go(() => navigate({ to: "/search", search: { q, page: 1, editions: false } }))
                  }
                  className="justify-center gap-2 rounded-lg text-sm text-dimmed"
                >
                  {t("layout.searchDialog.all", { q })} <ArrowRightIcon className="size-4" />
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
