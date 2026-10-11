import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { AuthForm } from "@/components/auth/auth-form";
import { useSession } from "@/hooks/auth";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const { user, isLoading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !isLoading) {
      navigate({ to: "/$username", params: { username: user.username ?? "" }, replace: true });
    }
  }, [user, isLoading, navigate]);

  return (
    <div className="flex min-h-[70dvh] items-center justify-center py-10">
      <AuthForm />
    </div>
  );
}
