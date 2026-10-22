import { useGetApiMe } from "@playdamnit/api-client";
import { Button } from "@/components/ui/button";
import { SafetySettings } from "@/components/settings/safety-settings";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { DatabaseIcon, FingerprintIcon, KeyRoundIcon, UserIcon } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { DataSettings } from "@/components/settings/data-settings";
import { PasskeySettings } from "@/components/settings/passkeys";
import { PasswordForm } from "@/components/settings/password-form";
import { ProfileForm } from "@/components/settings/profile-form";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/hooks/auth";
import { SettingsTab } from "@/lib/enums";

export const Route = createFileRoute("/$username_/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { t } = useTranslation();
  const { username } = Route.useParams();
  const { user, isLoading } = useSession();
  const navigate = useNavigate();
  const me = useGetApiMe({ query: { enabled: !!user } });
  const isOwn = !!user?.username && user.username.toLowerCase() === username.toLowerCase();

  // Settings belong to the signed-in user: guests go to sign-in, others to their own page
  useEffect(() => {
    if (isLoading) return;
    if (!user) navigate({ to: "/auth", replace: true });
    else if (!isOwn)
      navigate({
        to: "/$username/settings",
        params: { username: user.username ?? "" },
        replace: true,
      });
  }, [isLoading, user, isOwn, navigate]);

  if (isLoading || !user || !isOwn) return <Skeleton className="h-64 rounded-card" />;

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
        {me.data?.isModerator && (
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/moderation">{t("moderation.title")}</Link>
          </Button>
        )}
      </div>
      <p className="mt-1 text-sm text-dimmed">{t("settings.subtitle")}</p>

      <Tabs defaultValue={SettingsTab.Profile} className="mt-6">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value={SettingsTab.Profile}>
            <UserIcon /> {t("settings.tabs.profile")}
          </TabsTrigger>
          <TabsTrigger value={SettingsTab.Account}>
            <KeyRoundIcon /> {t("settings.tabs.account")}
          </TabsTrigger>
          <TabsTrigger value={SettingsTab.Passkeys}>
            <FingerprintIcon /> {t("settings.tabs.passkeys")}
          </TabsTrigger>
          <TabsTrigger value={SettingsTab.Data}>
            <DatabaseIcon /> {t("settings.tabs.data")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value={SettingsTab.Profile} className="mt-8">
          <ProfileForm user={{ ...user, ...me.data }} />
        </TabsContent>
        <TabsContent value={SettingsTab.Account} className="mt-8">
          <PasswordForm user={user} />
          <SafetySettings />
        </TabsContent>
        <TabsContent value={SettingsTab.Passkeys} className="mt-8">
          <PasskeySettings />
        </TabsContent>
        <TabsContent value={SettingsTab.Data} className="mt-8">
          <DataSettings username={user.username ?? ""} />
        </TabsContent>
      </Tabs>
    </>
  );
}
