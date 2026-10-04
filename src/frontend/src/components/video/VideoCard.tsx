import { createActor } from "@/backend";
import { Aura } from "@/components/ui/Aura";
import { VideoActions } from "@/components/video/VideoActions";
import { userService } from "@/services/users";
import type { Video } from "@/types";
import {
  formatCount,
  formatDuration,
  timeAgo,
  timestampToDate,
} from "@/utils/format";
import { useActor } from "@caffeineai/core-infrastructure";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { LockKeyhole, Play } from "lucide-react";

interface VideoCardProps {
  video: Video;
  /** Channel display name shown under the title. */
  channelName?: string;
  /** View count for the video. Falls back to a dash when omitted. */
  viewCount?: number | bigint;
  /** Duration in seconds for the overlay. Falls back to a dash when omitted. */
  durationSeconds?: number;
}

/**
 * A video card with a 16:9 thumbnail, a duration overlay, and metadata below
 * (title, channel name, view count, relative time). The thumbnail links to the
 * watch page and the channel name links to the channel page.
 */
export function VideoCard({
  video,
  channelName,
  viewCount,
  durationSeconds,
}: VideoCardProps) {
  const { actor, isFetching } = useActor(createActor);
  const channelQuery = useQuery({
    queryKey: ["channel", video.ownerId.toString()],
    queryFn: async () => {
      if (!actor) return null;
      return userService.getChannel(actor, video.ownerId);
    },
    enabled: channelName === undefined && !!actor && !isFetching,
  });
  const channel = channelName === undefined ? channelQuery.data : undefined;
  const resolvedChannelName =
    channelName ?? channel?.displayName ?? channel?.username ?? null;
  const thumbnailUrl = video.thumbnail?.getDirectURL() ?? null;

  const publishedDate = timestampToDate(video.publishedAt ?? video.createdAt);
  const relativeTime = timeAgo(publishedDate);
  const views = formatCount(viewCount ?? video.viewCount);

  return (
    <Aura className="block h-full w-full rounded-xl text-brand">
      <article
        data-ocid="video_card"
        className="group flex h-full flex-col rounded-xl border border-border bg-card transition-smooth hover:shadow-elevated"
      >
        <Link
          to="/watch/$videoId"
          params={{ videoId: video.id.toString() }}
          data-ocid="video_thumbnail_link"
          aria-label={`Watch ${video.title}`}
          className="relative block aspect-video overflow-hidden rounded-t-xl bg-muted"
        >
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt=""
              loading="lazy"
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-gradient-subtle">
              <Play
                className="size-10 text-primary/70 transition-colors group-hover:text-primary"
                aria-hidden="true"
              />
            </div>
          )}

          {/* Play affordance on hover */}
          <span
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30"
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-elevated transition-opacity group-hover:opacity-100">
              <Play className="size-5 fill-current" />
            </span>
          </span>

          {durationSeconds !== undefined ? (
            <span
              data-ocid="video_duration"
              className="absolute bottom-2 right-2 rounded-md bg-black/80 px-1.5 py-0.5 font-mono text-xs font-medium text-white"
            >
              {formatDuration(durationSeconds)}
            </span>
          ) : null}

          {video.isPrivate ? (
            <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-black/80 px-2 py-1 text-xs font-medium text-white">
              <LockKeyhole className="size-3" aria-hidden="true" />
              Private
            </span>
          ) : null}
        </Link>

        <div className="flex flex-1 flex-col gap-1.5 p-3">
          <Link
            to="/watch/$videoId"
            params={{ videoId: video.id.toString() }}
            data-ocid="video_title_link"
            className="line-clamp-2 font-display text-sm font-semibold leading-snug text-foreground transition-colors hover:text-primary"
          >
            {video.title}
          </Link>

          {resolvedChannelName ? (
            <Link
              to="/channel/$userId"
              params={{ userId: video.ownerId.toString() }}
              data-ocid="channel_link"
              className="truncate text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {resolvedChannelName}
            </Link>
          ) : channelQuery.isLoading ? (
            <span className="text-xs text-muted-foreground">
              Loading channel…
            </span>
          ) : (
            <span
              data-ocid="anonymous_channel"
              className="truncate text-xs text-muted-foreground"
            >
              Anonymous
            </span>
          )}

          <p data-ocid="video_views" className="text-xs text-muted-foreground">
            {views} views
            {relativeTime ? (
              <>
                <span aria-hidden="true" className="mx-1">
                  ·
                </span>
                {relativeTime}
              </>
            ) : null}
          </p>

          <VideoActions video={video} compact className="mt-auto pt-1" />
        </div>
      </article>
    </Aura>
  );
}
