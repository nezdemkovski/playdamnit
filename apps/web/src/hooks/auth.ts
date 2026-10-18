import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { t } from "@/i18n";
import { Char, QueryKey } from "@/lib/enums";
import { authClient } from "@/lib/authClient";

const SESSION_KEY = [QueryKey.Session] as const;
const PASSKEYS_KEY = [QueryKey.Passkeys] as const;

const errorMessage = (error: unknown, fallback: string) =>
  (error as { message?: string })?.message || fallback;

/** Unwrap Better Auth's `{ data, error }` result into a thrown error so mutations fail loudly */
const unwrap = <T>(result: { data: T; error: { message?: string } | null }): T => {
  if (result.error) throw new Error(result.error.message ?? t("toast.requestFailed"));
  return result.data;
};

export const useSession = () => {
  const query = useQuery({
    queryKey: SESSION_KEY,
    queryFn: async () => (await authClient.getSession()).data,
    staleTime: 5 * 60 * 1000,
  });
  return {
    user: query.data?.user ?? null,
    isLoading: query.isPending,
  };
};

const useInvalidateSession = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: SESSION_KEY });
};

export const useSignIn = () => {
  const invalidate = useInvalidateSession();

  const password = useMutation({
    mutationFn: async ({
      identifier,
      password: secret,
    }: {
      identifier: string;
      password: string;
    }) =>
      identifier.includes(Char.At)
        ? unwrap(await authClient.signIn.email({ email: identifier, password: secret }))
        : unwrap(await authClient.signIn.username({ username: identifier, password: secret })),
    onSuccess: invalidate,
    onError: (error) => toast.error(errorMessage(error, t("toast.signInFailed"))),
  });

  const passkey = useMutation({
    mutationFn: async () => unwrap(await authClient.signIn.passkey()),
    onSuccess: invalidate,
    onError: (error) => toast.error(errorMessage(error, t("toast.passkeySignInFailed"))),
  });

  return { password, passkey };
};

export const useSignUp = () => {
  const invalidate = useInvalidateSession();
  return useMutation({
    mutationFn: async (input: {
      email: string;
      password: string;
      name: string;
      username: string;
    }) => unwrap(await authClient.signUp.email(input)),
    onSuccess: invalidate,
    onError: (error) => toast.error(errorMessage(error, t("toast.signUpFailed"))),
  });
};

export const useSignOut = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async () => unwrap(await authClient.signOut()),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: PASSKEYS_KEY });
      await queryClient.invalidateQueries({ queryKey: SESSION_KEY });
      navigate({ to: "/" });
    },
  });
};

export const useUpdateProfile = () => {
  const invalidate = useInvalidateSession();
  return useMutation({
    mutationFn: async (input: { name?: string; username?: string; image?: string | null }) =>
      unwrap(await authClient.updateUser(input)),
    onSuccess: () => {
      invalidate();
      toast.success(t("toast.profileSaved"));
    },
    onError: (error) => toast.error(errorMessage(error, t("toast.profileSaveFailed"))),
  });
};

export const useChangePassword = () =>
  useMutation({
    mutationFn: async (input: { currentPassword: string; newPassword: string }) =>
      unwrap(await authClient.changePassword({ ...input, revokeOtherSessions: true })),
    onSuccess: () => toast.success(t("toast.passwordChanged")),
    onError: (error) => toast.error(errorMessage(error, t("toast.passwordChangeFailed"))),
  });

export const useChangeEmail = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newEmail: string) => {
      unwrap(await authClient.changeEmail({ newEmail, callbackURL: "/" }));
      // Either the address changed right away, or a confirmation went to the current inbox
      const session = (await authClient.getSession()).data;
      return session?.user.email.toLowerCase() === newEmail.toLowerCase();
    },
    onSuccess: (applied) => {
      queryClient.invalidateQueries({ queryKey: SESSION_KEY });
      toast.success(applied ? t("toast.emailUpdated") : t("toast.emailConfirm"));
    },
    onError: (error) => toast.error(errorMessage(error, t("toast.emailChangeFailed"))),
  });
};

export const useDeleteAccount = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async () => unwrap(await authClient.deleteUser()),
    onSuccess: async (result) => {
      if (result?.message === "Verification email sent") {
        toast.success(t("safety.deletionEmail"));
        return;
      }
      queryClient.clear();
      toast.success(t("toast.accountDeleted"));
      navigate({ to: "/" });
    },
    onError: (error) => toast.error(errorMessage(error, t("toast.accountDeleteFailed"))),
  });
};

export const usePasskeys = (enabled: boolean) =>
  useQuery({
    queryKey: PASSKEYS_KEY,
    queryFn: async () => unwrap(await authClient.passkey.listUserPasskeys()) ?? [],
    enabled,
  });

export const useAddPasskey = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name?: string) => unwrap(await authClient.passkey.addPasskey({ name })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PASSKEYS_KEY });
      toast.success(t("toast.passkeyAdded"));
    },
    onError: (error) => toast.error(errorMessage(error, t("toast.passkeyAddFailed"))),
  });
};

export const useDeletePasskey = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await authClient.passkey.deletePasskey({ id })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PASSKEYS_KEY });
      toast.success(t("toast.passkeyRemoved"));
    },
    onError: (error) => toast.error(errorMessage(error, t("toast.passkeyRemoveFailed"))),
  });
};
