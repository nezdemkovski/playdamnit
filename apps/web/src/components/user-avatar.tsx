import { cn } from "cn";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { avatarSrc, initialOf } from "@/lib/avatar";

interface UserAvatarProps {
  user: { username?: string | null; name?: string | null; image?: string | null };
  className?: string;
  textClassName?: string;
}

export function UserAvatar({ user, className, textClassName }: UserAvatarProps) {
  return (
    <Avatar className={cn("border border-white/30", className)}>
      <AvatarImage src={avatarSrc(user.image)} alt={user.name ?? ""} />
      <AvatarFallback className={cn("bg-[#1c1f21] font-semibold", textClassName)}>
        {initialOf(user)}
      </AvatarFallback>
    </Avatar>
  );
}
