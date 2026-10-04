import { createActor } from "@/backend";
import { config } from "@/config";
import { videoService } from "@/services/videos";
import type { Page, Video } from "@/types";
import { useActor } from "@caffeineai/core-infrastructure";
import { useQuery } from "@tanstack/react-query";

/**
 * Fetches a single page of the global feed.
 *
 * For infinite scrolling use {@link useInfiniteVideos} instead.
 */
export function useFeed() {
  const { actor, isFetching } = useActor(createActor);

  return useQuery<Page<Video>>({
    queryKey: ["feed"],
    queryFn: async () => {
      if (!actor) return { items: [] };
      return videoService.getFeed(actor, 0n, BigInt(config.feedPageSize));
    },
    enabled: !!actor && !isFetching,
  });
}
