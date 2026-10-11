import type { GameListInput, GameListSummary } from "@playdamnit/api-client";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

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
import { Textarea } from "@/components/ui/textarea";

interface ListFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  list?: GameListSummary | null;
  onSubmit: (input: GameListInput) => Promise<unknown>;
}

export function ListFormDialog({ open, onOpenChange, list, onSubmit }: ListFormDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(list?.name ?? "");
    setDescription(list?.description ?? "");
    setIsPublic(list?.isPublic ?? true);
  }, [open, list]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await onSubmit({ name: name.trim(), description: description.trim() || null, isPublic });
      onOpenChange(false);
    } catch {
      // toasted by the mutation
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-card border-white/5 bg-popover">
        <DialogHeader>
          <DialogTitle>{list ? t("lists.form.editTitle") : t("lists.form.newTitle")}</DialogTitle>
          <DialogDescription>{t("lists.form.description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="list-name">{t("lists.form.name")}</Label>
            <Input
              id="list-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="list-description">{t("lists.form.descriptionLabel")}</Label>
            <Textarea
              id="list-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch id="list-public" checked={isPublic} onCheckedChange={setIsPublic} />
            <Label htmlFor="list-public">{t("lists.form.public")}</Label>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={busy || !name.trim()}>
              {list ? t("common.save") : t("common.create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
