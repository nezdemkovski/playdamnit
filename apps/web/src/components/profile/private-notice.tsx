import { LockIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

export function PrivateNotice() {
  const { t } = useTranslation();
  return (
    <div className="panel flex flex-col items-center gap-2 p-12 text-center text-dimmed">
      <LockIcon className="size-6" />
      {t("profile.private")}
    </div>
  );
}
