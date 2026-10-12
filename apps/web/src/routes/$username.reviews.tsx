import {
  getApiUserByUsernameReviews,
  getGetApiUserByUsernameReviewsQueryKey,
} from "@playdamnit/api-client";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { LoadMore } from "@/components/load-more";
import { PrivateNotice } from "@/components/profile/private-notice";
import { ReviewCard } from "@/components/social/review-card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePaged } from "@/hooks/paged";
import { useProfileContext } from "@/hooks/profile";

const PAGE = 20;

export const Route = createFileRoute("/$username/reviews")({
  component: ProfileReviews,
});

function ProfileReviews() {
  const { t } = useTranslation();
  const { username, isPrivate } = useProfileContext();
  const reviews = usePaged({
    queryKey: getGetApiUserByUsernameReviewsQueryKey(username),
    fetchPage: (offset, limit, signal) =>
      getApiUserByUsernameReviews(username, { limit, offset }, undefined, signal),
    pageSize: PAGE,
    enabled: !isPrivate,
  });
  if (isPrivate) return <PrivateNotice />;
  if (reviews.isPending) return <Skeleton className="h-40 rounded-card" />;
  if (reviews.items.length === 0) {
    return <div className="panel p-12 text-center text-dimmed">{t("profile.reviews.empty")}</div>;
  }
  return (
    <div className="space-y-3">
      {reviews.items.map((review) => (
        <ReviewCard key={review.id} review={review} withGame />
      ))}
      <LoadMore {...reviews} />
    </div>
  );
}
