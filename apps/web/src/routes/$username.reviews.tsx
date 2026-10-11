import { useGetApiUserByUsernameReviews } from "@playdamnit/api-client";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { PrivateNotice } from "@/components/profile/private-notice";
import { ReviewCard } from "@/components/social/review-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfileContext } from "@/hooks/profile";

export const Route = createFileRoute("/$username/reviews")({
  component: ProfileReviews,
});

function ProfileReviews() {
  const { t } = useTranslation();
  const { username, isPrivate } = useProfileContext();
  const reviews = useGetApiUserByUsernameReviews(
    username,
    { limit: 100 },
    { query: { enabled: !isPrivate } },
  );
  if (isPrivate) return <PrivateNotice />;
  if (reviews.isPending) return <Skeleton className="h-40 rounded-card" />;
  if (!reviews.data || reviews.data.results.length === 0) {
    return <div className="panel p-12 text-center text-dimmed">{t("profile.reviews.empty")}</div>;
  }
  return (
    <div className="space-y-3">
      {reviews.data.results.map((review) => (
        <ReviewCard key={review.id} review={review} withGame />
      ))}
    </div>
  );
}
