import { LockIcon } from "lucide-react";

export function PrivateNotice() {
  return (
    <div className="panel flex flex-col items-center gap-2 p-12 text-center text-dimmed">
      <LockIcon className="size-6" />
      This member keeps their list private.
    </div>
  );
}
