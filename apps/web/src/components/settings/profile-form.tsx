import { useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateProfile } from "@/hooks/auth";
import type { SessionUser } from "@/lib/authClient";

export function ProfileForm({ user }: { user: SessionUser }) {
  const update = useUpdateProfile();
  const [name, setName] = useState(user.name ?? "");
  const [username, setUsername] = useState(user.username ?? "");
  const [image, setImage] = useState(user.image ?? "");

  const changed =
    name !== (user.name ?? "") ||
    username !== (user.username ?? "") ||
    image !== (user.image ?? "");

  return (
    <form
      className="grid gap-8 md:grid-cols-[200px_1fr]"
      onSubmit={(e) => {
        e.preventDefault();
        update.mutate({
          ...(name !== user.name && { name: name.trim() }),
          ...(username !== user.username && { username: username.trim() }),
          ...(image !== (user.image ?? "") && { image: image.trim() || null }),
        });
      }}
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <Avatar className="size-28 border border-white/30">
          <AvatarImage src={image || undefined} alt={name} />
          <AvatarFallback className="bg-[#1c1f21] text-4xl font-semibold">
            {(username || name || "?").slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="text-sm font-semibold">Avatar</div>
        <div className="text-xs text-dimmed">Paste an image URL on the right</div>
      </div>
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            pattern="^[a-zA-Z0-9_.]{3,30}$"
            required
          />
          <p className="text-xs text-dimmed">
            Your unique identifier. Appears in your profile URL.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Display name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your display name"
          />
          <p className="text-xs text-dimmed">Pick any name you like.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="image">Avatar URL</Label>
          <Input
            id="image"
            type="url"
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="https://…"
          />
        </div>
        <Button type="submit" disabled={!changed || update.isPending}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
