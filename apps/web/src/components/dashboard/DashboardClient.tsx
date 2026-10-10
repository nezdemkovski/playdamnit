import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  useSession,
  usePasskeys,
  useAddPasskey,
  useDeletePasskey,
  useSignOut,
} from "../../hooks/auth";

export default function DashboardClient() {
  const navigate = useNavigate();

  const { user, isLoadingSession } = useSession();
  const { passkeys, isLoadingPasskeys } = usePasskeys(user);
  const addPasskeyMutation = useAddPasskey();
  const { deletePasskeyMutation, deletingId } = useDeletePasskey();
  const { signOut } = useSignOut();

  useEffect(() => {
    if (!isLoadingSession && !user) {
      navigate({ to: "/auth" });
    }
  }, [isLoadingSession, user, navigate]);

  const handlePasskeyLogin = () => {
    addPasskeyMutation.mutate();
  };

  const handleDeletePasskey = (id: string) => {
    deletePasskeyMutation.mutate(id);
  };

  const isLoading =
    isLoadingSession ||
    isLoadingPasskeys ||
    addPasskeyMutation.isPending ||
    deletePasskeyMutation.isPending;

  if (isLoading || !user) {
    return (
      <div className="skeleton-container">
        <div className="skeleton-button-container">
          <div className="skeleton-button"></div>
        </div>
        <div className="skeleton-greeting"></div>
        <div className="skeleton-button"></div>
      </div>
    );
  }

  return (
    <div>
      <div>
        {passkeys?.map((passkey) => (
          <h2 key={passkey.id}>
            {passkey.id}
            <Button
              onClick={() => handleDeletePasskey(passkey.id)}
              disabled={deletingId === passkey.id}
            >
              {deletingId === passkey.id ? "Deleting..." : "Delete"}
            </Button>
          </h2>
        ))}
        <button onClick={handlePasskeyLogin} disabled={addPasskeyMutation.isPending}>
          {addPasskeyMutation.isPending ? "Registering..." : "Register Passkey"}
        </button>
      </div>
      {user && <h1>Hello, {user.email}</h1>}
      <button
        onClick={async () => {
          signOut.mutate();
          navigate({ to: "/auth" });
        }}
      >
        Sign out
      </button>
    </div>
  );
}
