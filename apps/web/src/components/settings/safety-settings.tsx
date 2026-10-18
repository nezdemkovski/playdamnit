import { useGetApiMeBlocks, deleteApiMeBlocksById } from "@playdamnit/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";

export function SafetySettings() {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const blocks = useGetApiMeBlocks();
  const unblock = useMutation({
    mutationFn: (id: string) => deleteApiMeBlocksById(id),
    onSuccess: () => cache.invalidateQueries(),
    onError: () => toast.error(t("safety.failed")),
  });
  return (
    <section className="mt-6 flex flex-col gap-6">
      <Separator />
      <h2 className="font-semibold">{t("safety.blocked")}</h2>
      {blocks.isPending ? (
        <Skeleton className="h-12" />
      ) : blocks.isError ? (
        <Button variant="ghost" onClick={() => blocks.refetch()}>
          {t("safety.retry")}
        </Button>
      ) : (
        <div className="divide-y divide-border">
          {blocks.data?.map((user) => (
            <div key={user.id} className="flex items-center gap-3 py-3">
              <UserAvatar user={user} className="size-8" />
              <span className="flex-1">{user.name}</span>
              <Button
                variant="ghost"
                size="sm"
                disabled={unblock.isPending}
                onClick={() => unblock.mutate(user.id)}
              >
                {t("safety.unblock")}
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
