import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Loader2Icon, SendIcon, SparklesIcon } from "lucide-react";
import { cn } from "cn";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { GameCard, GameRail } from "@/components/game/game-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getConfig } from "@/config";
import { useMyLibrary } from "@/hooks/library";
import type { ChatUIMessage } from "@/lib/chat";

interface AssistantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Chat with the API's game-search agent; found games render as cards */
export function AssistantDialog({ open, onOpenChange }: AssistantDialogProps) {
  const { t } = useTranslation();
  const [showOnlyGames, setShowOnlyGames] = useState(true);
  const showOnlyGamesRef = useRef(showOnlyGames);
  showOnlyGamesRef.current = showOnlyGames;
  const [input, setInput] = useState("");
  const { byGameId } = useMyLibrary();
  const bottom = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<ChatUIMessage>({
        api: `${getConfig().apiUrl}/api/chat/ai`,
        credentials: "include",
        body: () => ({ showOnlyGames: showOnlyGamesRef.current }),
      }),
    [],
  );
  const { messages, sendMessage, status, error } = useChat<ChatUIMessage>({ transport });
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages, status]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    sendMessage({ text });
    setInput("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85dvh] flex-col gap-0 rounded-card border-white/5 bg-popover p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-white/5 p-5 text-left">
          <DialogTitle className="flex items-center gap-2">
            <SparklesIcon className="size-5" /> {t("nav.aiAssistant")}
          </DialogTitle>
          <DialogDescription>{t("assistant.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-dimmed">
              <SparklesIcon className="size-8 opacity-40" />
              {t("assistant.empty")}
            </div>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[85%] space-y-3 rounded-2xl px-4 py-2.5 text-sm",
                  message.role === "user" ? "bg-primary text-primary-foreground" : "bg-white/5",
                )}
              >
                {message.parts.map((part, i) => {
                  if (part.type === "text")
                    return (
                      <p key={i} className="whitespace-pre-wrap">
                        {part.text}
                      </p>
                    );
                  if (part.type === "tool-search_games") {
                    if (part.state !== "output-available") {
                      return (
                        <div key={i} className="flex items-center gap-2 text-dimmed">
                          <Loader2Icon className="size-3.5 animate-spin" />{" "}
                          {t("assistant.searching", { query: part.input?.query ?? "" })}
                        </div>
                      );
                    }
                    const games = part.output.results;
                    if (games.length === 0)
                      return (
                        <p key={i} className="text-dimmed">
                          {t("assistant.nothing")}
                        </p>
                      );
                    return (
                      <GameRail key={i} className="[&>*]:w-24 sm:[&>*]:w-24 md:[&>*]:w-24">
                        {games.map((game) => (
                          <GameCard
                            key={game.id}
                            game={game}
                            rating={byGameId.get(game.id)?.userGameData.rating}
                          />
                        ))}
                      </GameRail>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          ))}
          {error && <p className="text-sm text-destructive">{error.message}</p>}
          <div ref={bottom} />
        </div>

        <form onSubmit={submit} className="space-y-3 border-t border-white/5 p-4">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("assistant.placeholder")}
              autoFocus
              className="rounded-full"
            />
            <Button
              type="submit"
              size="icon"
              disabled={busy || !input.trim()}
              aria-label={t("assistant.send")}
            >
              {busy ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="only-games" checked={showOnlyGames} onCheckedChange={setShowOnlyGames} />
            <Label htmlFor="only-games" className="text-xs text-dimmed">
              {t("assistant.onlyGames")}
            </Label>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
