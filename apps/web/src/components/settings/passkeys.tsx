import { FingerprintIcon, Trash2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAddPasskey, useDeletePasskey, usePasskeys } from "@/hooks/auth";
import { shortDate } from "@/lib/format";

export function PasskeySettings() {
  const { t } = useTranslation();
  const passkeys = usePasskeys(true);
  const add = useAddPasskey();
  const remove = useDeletePasskey();

  return (
    <div className="space-y-6">
      <p className="text-sm text-dimmed">{t("settings.passkeys.intro")}</p>
      <div className="space-y-2">
        {passkeys.isPending && <Skeleton className="h-14 rounded-lg" />}
        {passkeys.data?.length === 0 && (
          <div className="panel p-6 text-center text-sm text-dimmed">
            {t("settings.passkeys.empty")}
          </div>
        )}
        {passkeys.data?.map((key) => (
          <div key={key.id} className="panel flex items-center gap-3 p-4">
            <FingerprintIcon className="size-5 text-dimmed" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">
                {key.name || t("settings.passkeys.fallbackName")}
              </div>
              <div className="text-xs text-dimmed">
                {t("settings.passkeys.added", {
                  date: shortDate(key.createdAt ? new Date(key.createdAt).toISOString() : null),
                })}
                {key.deviceType ? ` · ${key.deviceType}` : ""}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("settings.passkeys.removeAria")}
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
        <FingerprintIcon /> {t("settings.passkeys.add")}
      </Button>
    </div>
  );
}
