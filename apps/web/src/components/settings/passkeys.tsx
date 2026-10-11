import { FingerprintIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAddPasskey, useDeletePasskey, usePasskeys } from "@/hooks/auth";
import { shortDate } from "@/lib/format";

export function PasskeySettings() {
  const passkeys = usePasskeys(true);
  const add = useAddPasskey();
  const remove = useDeletePasskey();

  return (
    <div className="space-y-6">
      <p className="text-sm text-dimmed">
        Passkeys let you sign in with Touch ID, Face ID or a security key instead of a password.
      </p>
      <div className="space-y-2">
        {passkeys.isPending && <Skeleton className="h-14 rounded-lg" />}
        {passkeys.data?.length === 0 && (
          <div className="panel p-6 text-center text-sm text-dimmed">No passkeys yet.</div>
        )}
        {passkeys.data?.map((key) => (
          <div key={key.id} className="panel flex items-center gap-3 p-4">
            <FingerprintIcon className="size-5 text-dimmed" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{key.name || "Passkey"}</div>
              <div className="text-xs text-dimmed">
                Added {shortDate(key.createdAt ? new Date(key.createdAt).toISOString() : null)}
                {key.deviceType ? ` · ${key.deviceType}` : ""}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Remove passkey"
              className="text-dimmed hover:text-destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate(key.id)}
            >
              <Trash2Icon />
            </Button>
          </div>
        ))}
      </div>
      <Button onClick={() => add.mutate(undefined)} disabled={add.isPending}>
        <FingerprintIcon /> Add a passkey
      </Button>
    </div>
  );
}
