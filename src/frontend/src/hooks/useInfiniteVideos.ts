import type { Cursor, Page, Video } from "@/types";
import { useCallback, useEffect, useRef, useState } from "react";

/** Fetcher signature for a cursor-paginated page of videos. */
export type VideoPageFetcher = (
  cursor: Cursor,
  limit: bigint,
) => Promise<Page<Video>>;

interface UseInfiniteVideosOptions {
  /** Fetches one page of videos given a cursor and page size. */
  fetcher: VideoPageFetcher;
  /** Number of videos requested per page. */
  pageSize: number;
  /** Whether the list should load. Disable while the actor is not ready. */
  enabled?: boolean;
}

/**
 * Infinite-scroll video list with cursor pagination.
 *
 * Renders a sentinel element (via `sentinelRef`) that an IntersectionObserver
 * watches; when it scrolls into view, the next page is fetched and appended.
 * Guards against duplicate in-flight requests and discards stale responses
 * when a newer request supersedes an older one.
 */
export function useInfiniteVideos({
  fetcher,
  pageSize,
  enabled = true,
}: UseInfiniteVideosOptions) {
  const [items, setItems] = useState<Video[]>([]);
  const [nextCursor, setNextCursor] = useState<Cursor | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);
  const requestIdRef = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const loadMore = useCallback(async () => {
    // Duplicate-request prevention: never fire while a request is in flight.
    if (loadingRef.current || !hasMore) return;

    loadingRef.current = true;
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const page = await fetcherRef.current(nextCursor ?? 0n, BigInt(pageSize));
      // Stale-request guard: ignore responses superseded by a newer request.
      if (requestId !== requestIdRef.current) return;

      setItems((previous) => {
        const seen = new Set(previous.map((video) => video.id.toString()));
        const fresh = page.items.filter(
          (video) => !seen.has(video.id.toString()),
        );
        return [...previous, ...fresh];
      });
      setNextCursor(page.nextCursor);
      setHasMore(page.nextCursor !== undefined);
    } catch (caught) {
      if (requestId !== requestIdRef.current) return;
      setError(
        caught instanceof Error ? caught : new Error("Failed to load videos"),
      );
    } finally {
      if (requestId === requestIdRef.current) {
        loadingRef.current = false;
        setIsLoading(false);
      }
    }
  }, [nextCursor, hasMore, pageSize]);

  // Initial page load: fetch the first page as soon as the hook is enabled,
  // even before the sentinel is rendered (the sentinel only appears once items
  // exist, so it can never trigger the first fetch on its own).
  useEffect(() => {
    if (!enabled) return;
    if (items.length === 0 && !loadingRef.current) {
      void loadMore();
    }
  }, [enabled, items.length, loadMore]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !enabled) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMore();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [enabled, loadMore]);

  /** Resets the list and restarts pagination from the first page. */
  const reset = useCallback(() => {
    requestIdRef.current += 1;
    loadingRef.current = false;
    setItems([]);
    setNextCursor(undefined);
    setHasMore(true);
    setError(null);
    setIsLoading(false);
  }, []);

  return { items, hasMore, loadMore, reset, isLoading, error, sentinelRef };
}
