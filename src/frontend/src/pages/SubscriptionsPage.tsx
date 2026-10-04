import { createActor } from "@/backend";
import { InfiniteScrollSentinel } from "@/components/common/InfiniteScrollSentinel";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Loader } from "@/components/ui/Loader";
import { Skeleton } from "@/components/ui/Skeleton";
import { VideoGrid } from "@/components/video/VideoGrid";
import { config } from "@/config";
import { useAuth } from "@/hooks/useAuth";
import {
  type VideoPageFetcher,
  useInfiniteVideos,
} from "@/hooks/useInfiniteVideos";
import { videoService } from "@/services/videos";
import { useActor } from "@caffeineai/core-infrastructure";
import { LogIn, Users } from "lucide-react";
import { useCallback } from "react";

/** Stable keys for skeleton placeholders (avoids array-index keys). */
const SUBSCRIPTIONS_SKELETON_KEYS = Array.from(
  { length: 6 },
  (_, i) => `subscriptions-skeleton-${i}`,
);

/** Layout-matched skeleton shown while the subscription feed first loads. */
function SubscriptionsSkeleton() {
  return (
    <div
      data-ocid="subscriptions_skeleton"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {SUBSCRIPTIONS_SKELETON_KEYS.map((key) => (
        <div
          key={key}
          className="overflow-hidden rounded-box border border-border bg-card"
        >
          <Skeleton className="aspect-video w-full rounded-none" />
          <div className="flex flex-col gap-2 p-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Subscriptions page — published videos from subscribed users, newest first,
 * loaded with backend cursor pagination and infinite scroll.
 */
export function SubscriptionsPage() {
  const { isAuthenticated, isInitializing, login } = useAuth();
  const { actor, isFetching } = useActor(createActor);

  const fetcher = useCallback<VideoPageFetcher>(
    (cursor, limit) => {
      if (!actor) return Promise.resolve({ items: [], nextCursor: undefined });
      return videoService.getSubscriptionFeed(actor, cursor, limit);
    },
    [actor],
  );

  const { items, hasMore, loadMore, isLoading, error } = useInfiniteVideos({
    fetcher,
    pageSize: config.feedPageSize,
    enabled: !!actor && !isFetching && isAuthenticated,
  });

  if (isInitializing) {
    return (
      <div className="p-4 sm:p-6">
        <SubscriptionsSkeleton />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="p-4 sm:p-6">
        <EmptyState
          icon={<Users className="size-7" aria-hidden="true" />}
          title="Sign in to see your subscriptions"
          description="Subscribe to channels to see their latest uploads here, newest first."
          action={
            <button
              type="button"
              data-ocid="sign_in_button"
              className="btn btn-primary"
              onClick={() => login()}
            >
              <LogIn className="size-4" aria-hidden="true" />
              Sign in
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <header className="mb-5">
        <h1 className="font-display text-2xl font-bold text-foreground">
          Subscriptions
        </h1>
        <p className="text-sm text-muted-foreground">
          Latest uploads from channels you follow
        </p>
      </header>

      {error ? (
        <ErrorState
          title="Couldn't load your subscriptions"
          message={error.message}
          onRetry={() => void loadMore()}
        />
      ) : isLoading && items.length === 0 ? (
        <SubscriptionsSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Users className="size-7" aria-hidden="true" />}
          title="No videos from your subscriptions yet"
          description="When channels you subscribe to publish videos, they'll show up here."
        />
      ) : (
        <>
          <VideoGrid videos={items} />
          <div className="mt-6 flex justify-center">
            {isLoading ? <Loader label="Loading more videos" /> : null}
          </div>
          <InfiniteScrollSentinel
            onIntersect={() => void loadMore()}
            disabled={!hasMore || isLoading}
          />
        </>
      )}
    </div>
  );
}
