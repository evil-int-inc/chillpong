import { VideoCard } from "@/components/video/VideoCard";
import type { Video } from "@/types";

interface VideoGridProps {
  videos: Video[];
  /** Channel display name shown on each card. */
  channelName?: string;
  /** View count per video, keyed by video id. */
  viewCounts?: Record<string, number | bigint>;
  /** Duration in seconds per video, keyed by video id. */
  durations?: Record<string, number>;
}

/**
 * Responsive grid of video cards — one column on mobile, two on small
 * screens, three on large screens.
 */
export function VideoGrid({
  videos,
  channelName,
  viewCounts,
  durations,
}: VideoGridProps) {
  return (
    <div
      data-ocid="video_grid"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {videos.map((video) => {
        const id = video.id.toString();
        return (
          <VideoCard
            key={id}
            video={video}
            channelName={channelName}
            viewCount={viewCounts?.[id]}
            durationSeconds={durations?.[id]}
          />
        );
      })}
    </div>
  );
}
