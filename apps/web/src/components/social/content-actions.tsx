import {
  ContentKind,
  ReportReason,
  postApiMeReports,
  putApiMeBlocksById,
} from "@playdamnit/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { EllipsisIcon, FlagIcon, UserRoundXIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useSession } from "@/hooks/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

export function ContentActions({
  kind,
  targetId,
  authorId,
  didBlock,
}: {
  kind: ContentKind;
  targetId: string;
  authorId: string;
  didBlock?: () => void;
}) {
  const { t } = useTranslation();
  const { user } = useSession();
  const cache = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const report = useMutation({
    mutationFn: (reason: ReportReason) => postApiMeReports({ kind, targetId, reason }),
    onSuccess: () => toast.success(t("safety.sent")),
    onError: () => toast.error(t("safety.failed")),
  });
  const block = useMutation({
    mutationFn: () => putApiMeBlocksById(authorId),
    onSuccess: async () => {
      didBlock?.();
      await cache.invalidateQueries();
    },
    onError: () => toast.error(t("safety.failed")),
  });
  if (!user || user.id === authorId) return null;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("safety.actions")}
            disabled={report.isPending || block.isPending}
          >
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FlagIcon className="mr-2 size-4" />
              {t("safety.report")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {Object.values(ReportReason).map((reason) => (
                <DropdownMenuItem key={reason} onSelect={() => report.mutate(reason)}>
                  {t(`safety.${reason}`)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onSelect={() => setConfirming(true)} className="text-destructive">
            <UserRoundXIcon />
            {t("safety.block")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("safety.block")}</AlertDialogTitle>
            <AlertDialogDescription>{t("safety.blockText")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => block.mutate()}>
              {t("safety.block")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
