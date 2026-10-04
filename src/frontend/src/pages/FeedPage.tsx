import { createActor } from "@/backend";
import { InfiniteScrollSentinel } from "@/components/common/InfiniteScrollSentinel";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Loader } from "@/components/ui/Loader";
import { Skeleton } from "@/components/ui/Skeleton";
import { VideoGrid } from "@/components/video/VideoGrid";
import { config } from "@/config";
import { useInfiniteVideos } from "@/hooks/useInfiniteVideos";
import { videoService } from "@/services/videos";
import { useActor } from "@caffeineai/core-infrastructure";
import { useSearch } from "@tanstack/react-router";
import { Clapperboard } from "lucide-react";
import { useCallback, useMemo } from "react";

/** Stable keys for skeleton placeholders (avoids array-index keys). */
const FEED_SKELETON_KEYS = Array.from(
  { length: config.feedPageSize },
  (_, i) => `feed-skeleton-${i}`,
);

/** Layout-matched skeleton grid shown while the first page loads. */
function FeedSkeleton() {
  return (
    <div
      data-ocid="feed_skeleton"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-hidden="true"
    >
      {FEED_SKELETON_KEYS.map((key) => (
        <div
          key={key}
          className="flex flex-col gap-2 overflow-hidden rounded-box border border-border bg-card p-3"
        >
          <Skeleton className="aspect-video w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

/**
 * Global feed of all published videos, newest first, with backend cursor
 * pagination and infinite scroll.
 */
export function FeedPage() {
  const { actor, isFetching } = useActor(createActor);
  const { q } = useSearch({ from: "/feed" });

  const fetcher = useCallback(
    (cursor: bigint, limit: bigint) => {
      if (!actor) return Promise.resolve({ items: [] });
      return videoService.getFeed(actor, cursor, limit);
    },
    [actor],
  );

  const { items, hasMore, loadMore, reset, isLoading, error } =
    useInfiniteVideos({
      fetcher,
      pageSize: config.feedPageSize,
      enabled: !!actor && !isFetching,
    });

  // Client-side filter of the paginated feed by the header search term.
  const query = q?.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    if (!query) return items;
    return items.filter((video) => {
      const haystack =
        `${video.title} ${video.description ?? ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [items, query]);

  const initialLoading = isLoading && items.length === 0 && !error;

  return (
    <section data-ocid="feed_page" className="flex flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold text-foreground">
          {query ? "Search results" : "Feed"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {query
            ? `Videos matching "${q?.trim()}" across ChillPong.`
            : "The latest videos from across ChillPong, newest first."}
        </p>
      </header>

      {error && items.length === 0 ? (
        <ErrorState
          title="Couldn't load the feed"
          message={error.message}
          onRetry={reset}
        />
      ) : initialLoading ? (
        <FeedSkeleton />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={<Clapperboard className="size-7" aria-hidden="true" />}
          title={query ? "No matching videos" : "No videos yet"}
          description={
            query
              ? `No videos matched "${q?.trim()}". Try a different search.`
              : "When creators publish videos, they'll show up here. Check back soon."
          }
        />
      ) : (
        <>
          <VideoGrid videos={filteredItems} />

          <InfiniteScrollSentinel
            onIntersect={() => void loadMore()}
            disabled={!hasMore || isLoading}
          />

          {isLoading && items.length > 0 ? (
            <div className="flex justify-center py-4">
              <Loader label="Loading more videos" />
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
