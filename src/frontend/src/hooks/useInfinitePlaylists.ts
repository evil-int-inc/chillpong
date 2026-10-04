import type { Cursor, PlaylistPage, PlaylistSummary } from "@/types";
import { useCallback, useEffect, useRef, useState } from "react";

export type PlaylistPageFetcher = (
  cursor: Cursor,
  limit: bigint,
) => Promise<PlaylistPage>;

interface UseInfinitePlaylistsOptions {
  fetcher: PlaylistPageFetcher;
  pageSize: number;
  enabled?: boolean;
}

export function useInfinitePlaylists({
  fetcher,
  pageSize,
  enabled = true,
}: UseInfinitePlaylistsOptions) {
  const [items, setItems] = useState<PlaylistSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<Cursor | undefined>();
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const loadingRef = useRef(false);
  const requestIdRef = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const page = await fetcherRef.current(nextCursor ?? 0n, BigInt(pageSize));
      if (requestId !== requestIdRef.current) return;
      setItems((previous) => {
        const seen = new Set(
          previous.map((playlist) => playlist.id.toString()),
        );
        return [
          ...previous,
          ...page.items.filter((playlist) => !seen.has(playlist.id.toString())),
        ];
      });
      setNextCursor(page.nextCursor);
      setHasMore(page.nextCursor !== undefined);
    } catch (caught) {
      if (requestId !== requestIdRef.current) return;
      setError(
        caught instanceof Error
          ? caught
          : new Error("Failed to load playlists"),
      );
    } finally {
      if (requestId === requestIdRef.current) {
        loadingRef.current = false;
        setIsLoading(false);
      }
    }
  }, [hasMore, nextCursor, pageSize]);

  useEffect(() => {
    if (enabled && items.length === 0 && !loadingRef.current) {
      void loadMore();
    }
  }, [enabled, items.length, loadMore]);

  const reset = useCallback(() => {
    requestIdRef.current += 1;
    loadingRef.current = false;
    setItems([]);
    setNextCursor(undefined);
    setHasMore(true);
    setIsLoading(false);
    setError(null);
  }, []);

  return { items, hasMore, loadMore, reset, isLoading, error };
}
