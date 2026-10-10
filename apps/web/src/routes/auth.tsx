import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { AuthForm } from "@/components/auth/auth-form";
import { useSession } from "@/hooks/auth";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const { user, isLoadingSession } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !isLoadingSession) {
      navigate({ to: "/$username", params: { username: user.username ?? "" } });
    }
  }, [user, isLoadingSession, navigate]);

  // if (isLoadingSession) {
  //   return (
  //     <div className="min-h-screen bg-playdamnit-darker text-playdamnit-light flex items-center justify-center">
  //       <div className="flex flex-col items-center">
  //         <Loader2 className="w-8 h-8 animate-spin text-playdamnit-purple mb-4" />
  //         <p className="text-playdamnit-light/70">Loading...</p>
  //       </div>
  //     </div>
  //   );
  // }

  return (
    // Same wrapper the Next.js (auth-pages) layout used
    <div className="max-w-7xl flex flex-col gap-12 items-start">
      <div className="min-h-screen bg-playdamnit-darker text-playdamnit-light flex items-center justify-center">
        {/* Simple decorative elements */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-playdamnit-purple/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-playdamnit-cyan/5 rounded-full blur-3xl"></div>

        {/* Auth form container */}
        <div className="flex items-center justify-center w-full">
          <AuthForm />
        </div>
      </div>
    </div>
  );
}
