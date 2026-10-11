import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useChangePassword } from "@/hooks/auth";
import type { SessionUser } from "@/lib/authClient";

export function PasswordForm({ user }: { user: SessionUser }) {
  const change = useChangePassword();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Label>Email</Label>
        <Input value={user.email} readOnly disabled />
        <p className="text-xs text-dimmed">
          {user.emailVerified ? "Verified." : "Not verified."} Email changes aren't supported yet.
        </p>
      </div>
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
    </div>
  );
}
