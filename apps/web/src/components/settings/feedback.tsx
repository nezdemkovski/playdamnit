import { FeedbackKind, ProductPlatform, usePostApiFeedback } from "@playdamnit/api-client";
import { BugIcon, LightbulbIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function FeedbackSettings() {
  const { t } = useTranslation();
  const [kind, setKind] = useState<FeedbackKind | null>(null);
  return (
    <div className="mt-8 flex flex-wrap gap-3 border-t border-border pt-6">
      <Button variant="outline" onClick={() => setKind(FeedbackKind.Feature)}>
        <LightbulbIcon />
        {t("feedback.feature")}
      </Button>
      <Button variant="outline" onClick={() => setKind(FeedbackKind.Bug)}>
        <BugIcon />
        {t("feedback.bug")}
      </Button>
      <Dialog
        open={kind !== null}
        onOpenChange={(open) => {
          if (!open) setKind(null);
        }}
      >
        <DialogContent>
          {kind && <FeedbackForm key={kind} kind={kind} done={() => setKind(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FeedbackForm({ kind, done }: { kind: FeedbackKind; done: () => void }) {
  const { t, i18n } = useTranslation();
  const send = usePostApiFeedback();
  const [message, setMessage] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const edited = () => {
    setRequestId(crypto.randomUUID());
    send.reset();
  };
  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {kind === FeedbackKind.Bug ? t("feedback.bug") : t("feedback.feature")}
        </DialogTitle>
        <DialogDescription>{t("feedback.metadata")}</DialogDescription>
      </DialogHeader>
      {send.isSuccess ? (
        <div className="space-y-4">
          <p role="status">{t("feedback.sent")}</p>
          <Button onClick={done}>{t("feedback.done")}</Button>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (send.isPending || !message.trim()) return;
            send.mutate({
              data: {
                requestId,
                kind,
                title: feedbackTitle(message),
                message: message.trim(),
                platform: ProductPlatform.Web,
                locale: i18n.language,
              },
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="feedback-message">{t("feedback.message")}</Label>
            <Textarea
              id="feedback-message"
              value={message}
              required
              maxLength={5000}
              rows={6}
              disabled={send.isPending}
              onChange={(event) => {
                setMessage(event.target.value);
                edited();
              }}
            />
          </div>
          {send.isError && (
            <p role="alert" className="text-sm text-destructive">
              {t("feedback.failed")}
            </p>
          )}
          <Button type="submit" disabled={send.isPending || !message.trim()}>
            {send.isPending ? t("feedback.sending") : t("feedback.send")}
          </Button>
        </form>
      )}
    </>
  );
}

function feedbackTitle(message: string) {
  let title = "";
  for (const character of message.trim().replace(/\s+/g, " ")) {
    if (title.length + character.length > 160) break;
    title += character;
  }
  return title;
}
