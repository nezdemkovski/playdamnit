import { ImageUpIcon, Trash2Icon } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { UsernameField, useUsernameCheck } from "@/components/auth/username-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { useUpdateProfile } from "@/hooks/auth";
import { useProfileUpdate } from "@/hooks/social";
import { t } from "@/i18n";
import type { SessionUser } from "@/lib/authClient";
import { UploadFileName, UploadMimeType } from "@/lib/enums";

const AVATAR_SIZE = 256;
const MAX_BIO = 300;
const MAX_LINKS = 5;

type ProfileUser = SessionUser & {
  bio?: string | null;
  links?: string[];
  listPublic?: boolean;
  steamAvatarUrl?: string | null;
};

/** Resize the picture in the browser so the upload stays small (JPEG, 256px square) */
const resizeAvatar = (file: File): Promise<File> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = AVATAR_SIZE;
      canvas.height = AVATAR_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error(t("settings.profile.errors.canvas")));
      ctx.drawImage(
        img,
        (img.width - side) / 2,
        (img.height - side) / 2,
        side,
        side,
        0,
        0,
        AVATAR_SIZE,
        AVATAR_SIZE,
      );
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(new File([blob], UploadFileName.Avatar, { type: UploadMimeType.Jpeg }))
            : reject(new Error(t("settings.profile.errors.encode"))),
        UploadMimeType.Jpeg,
        0.88,
      );
    };
    img.onerror = () => reject(new Error(t("settings.profile.errors.notImage")));
    img.src = url;
  });

export function ProfileForm({ user }: { user: ProfileUser }) {
  const { t } = useTranslation();
  const update = useUpdateProfile();
  const social = useProfileUpdate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user.name ?? "");
  const [username, setUsername] = useState(user.username ?? "");
  const [bio, setBio] = useState(user.bio ?? "");
  const [links, setLinks] = useState<string[]>(user.links?.length ? user.links : [""]);
  const [listPublic, setListPublic] = useState(user.listPublic ?? true);
  const usernameCheck = useUsernameCheck(username, user.username);

  const cleanLinks = links.map((l) => l.trim()).filter(Boolean);
  const changedAuth = name !== (user.name ?? "") || username !== (user.username ?? "");
  const changedProfile =
    bio !== (user.bio ?? "") ||
    cleanLinks.join("\n") !== (user.links ?? []).join("\n") ||
    listPublic !== (user.listPublic ?? true);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (changedAuth) {
      await update.mutateAsync({
        ...(name !== user.name && { name: name.trim() }),
        ...(username !== user.username && { username: username.trim() }),
      });
    }
    if (changedProfile)
      await social.save({ bio: bio.trim() || null, links: cleanLinks, listPublic });
  };

  const pickAvatar = async (file: File | undefined) => {
    if (!file) return;
    try {
      await social.uploadAvatar(await resizeAvatar(file));
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <form className="grid gap-8 md:grid-cols-[220px_1fr]" onSubmit={submit}>
      <div className="flex flex-col items-center gap-3 text-center">
        <UserAvatar
          user={{ ...user, name, username }}
          className="size-28"
          textClassName="text-4xl"
        />
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pickAvatar(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => fileInput.current?.click()}
          disabled={social.isPending}
        >
          <ImageUpIcon /> {t("settings.profile.uploadAvatar")}
        </Button>
        {user.image && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="text-dimmed"
            onClick={() => social.clearAvatar()}
            disabled={social.isPending}
          >
            <Trash2Icon /> {t("common.remove")}
          </Button>
        )}
        {!user.image && user.steamAvatarUrl && (
          <p className="text-xs text-dimmed">{t("steam.avatarHint")}</p>
        )}
        <div className="text-xs text-dimmed">{t("settings.profile.avatarHint")}</div>
      </div>
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="username">{t("settings.profile.username")}</Label>
          <UsernameField
            id="username"
            value={username}
            onChange={setUsername}
            check={usernameCheck}
          />
          <p className="text-xs text-dimmed">{t("settings.profile.usernameHint")}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">{t("settings.profile.displayName")}</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("settings.profile.displayNamePlaceholder")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bio">{t("settings.profile.bio")}</Label>
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, MAX_BIO))}
            placeholder={t("settings.profile.bioPlaceholder")}
            className="min-h-20"
          />
          <div className="text-right text-xs text-dimmed">
            {bio.length} / {MAX_BIO}
          </div>
        </div>
        <div className="space-y-2">
          <Label>{t("settings.profile.links")}</Label>
          {links.map((link, i) => (
            <div key={i} className="flex gap-2">
              <Input
                type="url"
                value={link}
                onChange={(e) => setLinks(links.map((l, j) => (j === i ? e.target.value : l)))}
                placeholder="https://"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("settings.profile.removeLink")}
                className="text-dimmed"
                onClick={() => setLinks(links.length > 1 ? links.filter((_, j) => j !== i) : [""])}
              >
                <Trash2Icon />
              </Button>
            </div>
          ))}
          {links.length < MAX_LINKS && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setLinks([...links, ""])}
            >
              {t("settings.profile.addLink")}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Switch id="list-public" checked={listPublic} onCheckedChange={setListPublic} />
          <Label htmlFor="list-public">{t("settings.profile.publicList")}</Label>
          <span className="text-xs text-dimmed">{t("settings.profile.publicListHint")}</span>
        </div>
        <Button
          type="submit"
          disabled={
            (!changedAuth && !changedProfile) ||
            update.isPending ||
            social.isPending ||
            usernameCheck.blocked
          }
        >
          {t("settings.profile.save")}
        </Button>
      </div>
    </form>
  );
}
