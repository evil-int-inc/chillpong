import { ExternalBlob } from "@/backend";
import {
  type VideoPageFetcher,
  useInfiniteVideos,
} from "@/hooks/useInfiniteVideos";
import type { Video } from "@/types";
import { VideoStatus } from "@/types";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

function makeVideo(id: bigint, title: string): Video {
  return {
    id,
    title,
    status: VideoStatus.published,
    ownerId: "aaaaa-aa" as unknown as Video["ownerId"],
    createdAt: 0n,
    video: ExternalBlob.fromURL(`https://example.com/video-${id}`),
    filename: `video-${id}.mp4`,
    mimeType: "video/mp4",
    fileSize: 100n,
    viewCount: 0n,
    isPrivate: false,
  };
}

describe("useInfiniteVideos", () => {
  it("loads the first page on mount even before the sentinel renders", async () => {
    const fetcher = vi.fn<VideoPageFetcher>(async () => ({
      items: [makeVideo(3n, "three"), makeVideo(2n, "two")],
      nextCursor: 2n,
    }));

    const { result } = renderHook(() =>
      useInfiniteVideos({ fetcher, pageSize: 2 }),
    );

    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(0n, 2n);
    await waitFor(() => expect(result.current.hasMore).toBe(true));
  });

  it("does not fire a duplicate request while one is in flight", async () => {
    let resolveFirst: (page: { items: Video[]; nextCursor?: bigint }) => void;
    const first = new Promise<{ items: Video[]; nextCursor?: bigint }>(
      (resolve) => {
        resolveFirst = resolve;
      },
    );
    const fetcher = vi.fn<VideoPageFetcher>(() => first);

    const { result } = renderHook(() =>
      useInfiniteVideos({ fetcher, pageSize: 2 }),
    );

    // Trigger loadMore twice while the first request is still pending.
    act(() => {
      void result.current.loadMore();
      void result.current.loadMore();
    });

    await act(async () => {
      resolveFirst!({ items: [makeVideo(1n, "one")], nextCursor: undefined });
    });

    await waitFor(() => expect(result.current.items).toHaveLength(1));
    // Only one request should have been issued despite two loadMore calls.
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.current.hasMore).toBe(false);
  });

  it("appends the next page and deduplicates overlapping items", async () => {
    const fetcher = vi.fn<VideoPageFetcher>(async (cursor) => {
      if (cursor === 0n) {
        return {
          items: [makeVideo(3n, "three"), makeVideo(2n, "two")],
          nextCursor: 2n,
        };
      }
      return {
        items: [makeVideo(2n, "two"), makeVideo(1n, "one")],
        nextCursor: undefined,
      };
    });

    const { result } = renderHook(() =>
      useInfiniteVideos({ fetcher, pageSize: 2 }),
    );

    await waitFor(() => expect(result.current.items).toHaveLength(2));

    act(() => {
      void result.current.loadMore();
    });

    await waitFor(() => expect(result.current.items).toHaveLength(3));
    // The overlapping video (id 2) is not duplicated.
    expect(result.current.items.map((v) => v.id.toString())).toEqual([
      "3",
      "2",
      "1",
    ]);
    expect(result.current.hasMore).toBe(false);
  });

  it("does not load when disabled", async () => {
    const fetcher = vi.fn<VideoPageFetcher>(async () => ({
      items: [],
      nextCursor: undefined,
    }));

    const { result } = renderHook(() =>
      useInfiniteVideos({ fetcher, pageSize: 2, enabled: false }),
    );

    expect(result.current.items).toHaveLength(0);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
