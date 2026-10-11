import { useGetApiUserByUsernameLists } from "@playdamnit/api-client";
import { createFileRoute } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { ListCard } from "@/components/lists/list-card";
import { ListFormDialog } from "@/components/lists/list-form-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfileContext } from "@/hooks/profile";
import { useListMutations } from "@/hooks/social";

export const Route = createFileRoute("/$username/lists")({
  component: ProfileLists,
});

function ProfileLists() {
  const { username, isOwn } = useProfileContext();
  const lists = useGetApiUserByUsernameLists(username);
  const mutations = useListMutations();
  const [creating, setCreating] = useState(false);

  return (
    <>
      {isOwn && (
        <div className="mb-4 flex justify-end">
          <Button size="sm" onClick={() => setCreating(true)}>
            <PlusIcon /> New list
          </Button>
        </div>
      )}
      {lists.isPending && <Skeleton className="h-40 rounded-card" />}
      {lists.data?.length === 0 && (
        <div className="panel p-12 text-center text-dimmed">
          No lists yet. "Top 10 of all time" is right there.
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {lists.data?.map((list) => (
          <ListCard key={list.id} list={list} />
        ))}
      </div>
      <ListFormDialog
        open={creating}
        onOpenChange={setCreating}
        onSubmit={(input) => mutations.create(input)}
      />
    </>
  );
}
