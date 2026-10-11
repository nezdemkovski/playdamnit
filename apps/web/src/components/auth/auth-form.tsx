import { FingerprintIcon, Loader2Icon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSignIn, useSignUp } from "@/hooks/auth";

const USERNAME_PATTERN = "^[a-zA-Z0-9_.]{3,30}$";

/** Sign-in (password or passkey) and sign-up, in one card */
export function AuthForm() {
  const { t } = useTranslation();
  const signIn = useSignIn();
  const signUp = useSignUp();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const busy = signIn.password.isPending || signIn.passkey.isPending || signUp.isPending;

  return (
    <div className="panel w-full max-w-md p-6 sm:p-8">
      <div className="mb-6 flex items-center gap-3">
        <img src="/logo.svg" alt="" className="size-10" />
        <div>
          <h1 className="text-xl font-bold">{t("app.name")}</h1>
          <p className="text-sm text-dimmed">{t("auth.tagline")}</p>
        </div>
      </div>

      <Tabs defaultValue="sign-in">
        <TabsList className="w-full">
          <TabsTrigger value="sign-in" className="flex-1">
            {t("auth.tabSignIn")}
          </TabsTrigger>
          <TabsTrigger value="sign-up" className="flex-1">
            {t("auth.tabSignUp")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sign-in" className="mt-6">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              signIn.password.mutate({ identifier: identifier.trim(), password });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="identifier">{t("auth.identifier")}</Label>
              <Input
                id="identifier"
                autoComplete="username"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {signIn.password.isPending && <Loader2Icon className="animate-spin" />}{" "}
              {t("auth.signIn")}
            </Button>
          </form>
          <div className="my-4 flex items-center gap-3 text-xs text-dimmed">
            <span className="h-px flex-1 bg-white/10" />
            {t("common.or")}
            <span className="h-px flex-1 bg-white/10" />
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            size="lg"
            disabled={busy}
            onClick={() => signIn.passkey.mutate()}
          >
            <FingerprintIcon /> {t("auth.passkey")}
          </Button>
        </TabsContent>

        <TabsContent value="sign-up" className="mt-6">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              signUp.mutate({
                name: name.trim(),
                username: username.trim(),
                email: email.trim(),
                password: newPassword,
              });
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">{t("auth.displayName")}</Label>
                <Input
                  id="name"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">{t("auth.username")}</Label>
                <Input
                  id="username"
                  autoComplete="username"
                  required
                  pattern={USERNAME_PATTERN}
                  title={t("auth.usernameHint")}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">{t("auth.password")}</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {signUp.isPending && <Loader2Icon className="animate-spin" />}{" "}
              {t("auth.createAccount")}
            </Button>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
