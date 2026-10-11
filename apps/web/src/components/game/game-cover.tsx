import { Gamepad2Icon } from "lucide-react";
import { cn } from "cn";

import { igdbImage, type IgdbSize } from "@/lib/image";

interface GameCoverProps {
  url: string | null | undefined;
  name: string;
  size?: IgdbSize;
  className?: string;
  loading?: "lazy" | "eager";
}

/** Poster image with the catalog's 3:4 shape and a placeholder when IGDB has no cover */
export function GameCover({
  url,
  name,
  size = "cover_big",
  className,
  loading = "lazy",
}: GameCoverProps) {
  const src = igdbImage(url, size);
  return (
    <div className={cn("cover relative", className)}>
      {src ? (
        <img
          src={src}
          alt={name}
          loading={loading}
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-dimmed/50">
          <Gamepad2Icon className="size-1/3" strokeWidth={1.25} />
        </div>
      )}
    </div>
  );
}
