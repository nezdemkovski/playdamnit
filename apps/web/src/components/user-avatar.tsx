import { cn } from "cn";

import { useTranslation } from "react-i18next";
import { SteamLogo } from "@/components/steam/steam-logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { avatarSrc, initialOf } from "@/lib/avatar";

interface UserAvatarProps {
  user: {
    username?: string | null;
    name?: string | null;
    image?: string | null;
    steamAvatarUrl?: string | null;
  };
  className?: string;
  textClassName?: string;
}

export function UserAvatar({ user, className, textClassName }: UserAvatarProps) {
  const { t } = useTranslation();
  const fromSteam = !user.image && !!user.steamAvatarUrl;
  return (
    <span className="relative inline-flex shrink-0">
      <Avatar className={cn("border border-white/30", className)}>
        <AvatarImage src={avatarSrc(user.image || user.steamAvatarUrl)} alt={user.name ?? ""} />
        <AvatarFallback className={cn("bg-[#1c1f21] font-semibold", textClassName)}>
          {initialOf(user)}
        </AvatarFallback>
      </Avatar>
      {fromSteam && (
        <span
          className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-background text-foreground ring-1 ring-border"
          role="img"
          aria-label={t("steam.avatarSource")}
          title={t("steam.avatarSource")}
        >
          <SteamLogo className="size-3" />
        </span>
      )}
    </span>
  );
}
