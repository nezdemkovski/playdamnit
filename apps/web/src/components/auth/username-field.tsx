import { UsernameProblemEnum, useGetApiUsersUsernameCheck } from "@playdamnit/api-client";
import { CheckIcon, Loader2Icon, XIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounced } from "@/hooks/debounced";

const CHECK_DELAY_MS = 400;

/**
 * Whether the name typed can be had, asked of the API half a second after the last key. The
 * unchanged name (Settings) is not asked about. `blocked` holds the form back on a known "no";
 * when the API can't be asked, saving finds out.
 */
export const useUsernameCheck = (raw: string, current?: string | null) => {
  const name = raw.trim();
  const debounced = useDebounced(name, CHECK_DELAY_MS);
  const unchanged = !!current && name === current;
  const query = useGetApiUsersUsernameCheck(
    { username: debounced },
    { query: { enabled: debounced.length > 0 && !unchanged, staleTime: 30_000, retry: false } },
  );
  const settled = debounced === name;
  const verdict = name && !unchanged && settled ? query.data : undefined;
  return {
    verdict,
    checking: !!name && !unchanged && (!settled || query.isFetching),
    blocked: !!name && !unchanged && (!settled || query.isFetching || verdict?.available === false),
  };
};

/** The username input with a ✓ or ✗ at its end, what is wrong under it and free names to take */
export function UsernameField({
  id,
  value,
  onChange,
  check,
  autoComplete,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  check: ReturnType<typeof useUsernameCheck>;
  autoComplete?: string;
}) {
  const { t } = useTranslation();
  const { verdict, checking } = check;
  const message =
    verdict?.reason === UsernameProblemEnum.Taken
      ? t("auth.usernameTaken", { name: verdict.username })
      : verdict && !verdict.valid
        ? t("auth.usernameHint")
        : null;
  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          id={id}
          autoComplete={autoComplete}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={verdict?.available === false || undefined}
          aria-describedby={message ? `${id}-note` : undefined}
          className="pr-9"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
          {checking ? (
            <Loader2Icon className="size-4 animate-spin text-dimmed" />
          ) : verdict?.available ? (
            <CheckIcon className="size-4 text-done" aria-label={t("auth.usernameAvailable")} />
          ) : verdict ? (
            <XIcon className="size-4 text-signal" aria-label={t("auth.usernameUnavailable")} />
          ) : null}
        </span>
      </div>
      {message && (
        <div id={`${id}-note`} className="space-y-2" aria-live="polite">
          <p className="text-xs text-signal">{message}</p>
          {verdict && verdict.suggestions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {verdict.suggestions.map((suggestion) => (
                <Button
                  key={suggestion}
                  type="button"
                  variant="secondary"
                  size="xs"
                  onClick={() => onChange(suggestion)}
                >
                  @{suggestion}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
