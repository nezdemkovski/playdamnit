import { Trash2Icon } from "lucide-react";
import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useChangeEmail, useChangePassword, useDeleteAccount } from "@/hooks/auth";
import type { SessionUser } from "@/lib/authClient";

/** Account tab: email, password and the way out */
export function PasswordForm({ user }: { user: SessionUser }) {
  const { t } = useTranslation();
  const change = useChangePassword();
  const changeEmail = useChangeEmail();
  const deleteAccount = useDeleteAccount();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [email, setEmail] = useState(user.email);

  return (
    <div className="space-y-10">
      <form
        className="max-w-sm space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          changeEmail.mutate(email.trim());
        }}
      >
        <h3 className="font-semibold">{t("settings.account.email")}</h3>
        <div className="space-y-2">
          <Label htmlFor="email">{t("settings.account.address")}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <p className="text-xs text-dimmed">
            {user.emailVerified
              ? t("settings.account.verified")
              : t("settings.account.notVerified")}
          </p>
        </div>
        <Button
          type="submit"
          disabled={
            changeEmail.isPending || email.trim().toLowerCase() === user.email.toLowerCase()
          }
        >
          {t("settings.account.changeEmail")}
        </Button>
      </form>

      <form
        className="max-w-sm space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          change.mutate(
            { currentPassword: current, newPassword: next },
            {
              onSuccess: () => {
                setCurrent("");
                setNext("");
              },
            },
          );
        }}
      >
        <h3 className="font-semibold">{t("settings.account.changePassword")}</h3>
        <div className="space-y-2">
          <Label htmlFor="current-password">{t("settings.account.currentPassword")}</Label>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-password">{t("settings.account.newPassword")}</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={change.isPending}>
          {t("settings.account.updatePassword")}
        </Button>
        <p className="text-xs text-dimmed">{t("settings.account.otherSessions")}</p>
      </form>

      <section className="max-w-sm space-y-4 rounded-card border border-destructive/30 p-5">
        <h3 className="font-semibold text-destructive">{t("settings.account.deleteTitle")}</h3>
        <p className="text-sm text-dimmed">{t("settings.account.deleteText")}</p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={deleteAccount.isPending}>
              <Trash2Icon /> {t("settings.account.deleteButton")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-card">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("settings.account.deleteDialogTitle", { username: user.username })}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("settings.account.deleteDialogText")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("settings.account.keepAccount")}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={() => deleteAccount.mutate()}
              >
                {t("settings.account.deleteEverything")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </div>
  );
}
