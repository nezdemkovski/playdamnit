import { Trash2Icon } from "lucide-react";
import { useState } from "react";

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
  const change = useChangePassword();
  const changeEmail = useChangeEmail();
  const deleteAccount = useDeleteAccount();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [email, setEmail] = useState(user.email);
  const [deletePassword, setDeletePassword] = useState("");

  return (
    <div className="space-y-10">
      <form
        className="max-w-sm space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          changeEmail.mutate(email.trim());
        }}
      >
        <h3 className="font-semibold">Email</h3>
        <div className="space-y-2">
          <Label htmlFor="email">Address</Label>
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
              ? "Verified. A change is confirmed from your current inbox first."
              : "Not verified."}
          </p>
        </div>
        <Button
          type="submit"
          disabled={
            changeEmail.isPending || email.trim().toLowerCase() === user.email.toLowerCase()
          }
        >
          Change email
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
        <h3 className="font-semibold">Change password</h3>
        <div className="space-y-2">
          <Label htmlFor="current-password">Current password</Label>
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
          <Label htmlFor="new-password">New password</Label>
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
          Update password
        </Button>
        <p className="text-xs text-dimmed">
          Other sessions are signed out when the password changes.
        </p>
      </form>

      <section className="max-w-sm space-y-4 rounded-card border border-destructive/30 p-5">
        <h3 className="font-semibold text-destructive">Delete account</h3>
        <p className="text-sm text-dimmed">
          Your list, reviews, lists, playthroughs, likes and follows are deleted immediately. There
          is no undo; export your list first if you want to keep it.
        </p>
        <div className="space-y-2">
          <Label htmlFor="delete-password">Confirm with your password</Label>
          <Input
            id="delete-password"
            type="password"
            autoComplete="current-password"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
          />
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={!deletePassword || deleteAccount.isPending}>
              <Trash2Icon /> Delete my account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-card">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete @{user.username}?</AlertDialogTitle>
              <AlertDialogDescription>
                Everything you logged on PlayDamnIt is removed for good.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep my account</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={() => deleteAccount.mutate(deletePassword)}
              >
                Delete everything
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </div>
  );
}
