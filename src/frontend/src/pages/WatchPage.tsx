import { createActor } from "@/backend";
import { PlaylistQueue } from "@/components/playlist/PlaylistQueue";
import { PlaylistSaveButton } from "@/components/playlist/PlaylistSaveButton";
import { SubscribeButton } from "@/components/subscription/SubscribeButton";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { VideoActions } from "@/components/video/VideoActions";
import { VideoPlayer } from "@/components/video/VideoPlayer";
import { useAuth } from "@/services/hooks";
import { playlistService } from "@/services/playlists";
import { userService } from "@/services/users";
import { videoService } from "@/services/videos";
import { type PlaylistView, type User, type Video, VideoStatus } from "@/types";
import {
  formatBytes,
  formatCount,
  timeAgo,
  timestampToDate,
} from "@/utils/format";
import { useActor } from "@caffeineai/core-infrastructure";
import type { Principal } from "@icp-sdk/core/principal";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Link,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import { Eye, ListVideo, LockKeyhole, VideoOff, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";

/** Fetches a single video by id from the backend. */
function useGetVideo(videoId: bigint, viewerKey: string) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<Video | null>({
    queryKey: ["video", videoId.toString(), viewerKey],
    queryFn: async () => {
      if (!actor) return null;
      return videoService.getVideo(actor, videoId);
    },
    enabled: !!actor && !isFetching,
  });
}

/** Fetches the channel (owner) profile for a video. */
function useGetChannel(ownerId: Principal | null) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<User | null>({
    queryKey: ["channel", ownerId?.toString() ?? "none"],
    queryFn: async () => {
      if (!actor || !ownerId) return null;
      return userService.getChannel(actor, ownerId);
    },
    enabled: !!actor && !isFetching && !!ownerId,
  });
}

/** Fetches a caller-filtered playlist queue without blocking video playback. */
function useGetPlaylist(playlistId: bigint | null, viewerKey: string) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<PlaylistView | null>({
    queryKey: ["playlist", playlistId?.toString() ?? "none", viewerKey],
    queryFn: async () => {
      if (!actor || playlistId === null) return null;
      return playlistService.getPlaylist(actor, playlistId);
    },
    enabled: !!actor && !isFetching && playlistId !== null,
  });
}

export function WatchPage() {
  const { videoId } = useParams({ from: "/watch/$videoId" });
  const { list } = useSearch({ from: "/watch/$videoId" });
  const navigate = useNavigate();
  const { principal } = useAuth();
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  const recordedViewRef = useRef<string | null>(null);

  const parsedId = /^\d+$/.test(videoId) ? BigInt(videoId) : null;
  const playlistId = list && /^\d+$/.test(list) ? BigInt(list) : null;
  const viewerKey = principal ?? "anonymous";
  const videoQuery = useGetVideo(parsedId ?? 0n, viewerKey);
  const playlistQuery = useGetPlaylist(playlistId, viewerKey);
  const video = videoQuery.data ?? null;
  const playlistView = playlistQuery.data ?? null;
  const [autoplayNext, setAutoplayNext] = useState(true);

  const ownerId = video?.ownerId ?? null;
  const channelQuery = useGetChannel(ownerId);
  const channel = channelQuery.data ?? null;

  const isLoading = videoQuery.isLoading || (!!video && channelQuery.isLoading);
  const isOwnChannel =
    !!principal && !!ownerId && principal === ownerId.toString();

  const recordFirstPlay = useCallback(() => {
    if (!actor || !video) return;
    const id = video.id.toString();
    if (recordedViewRef.current === id) return;
    recordedViewRef.current = id;

    void videoService
      .recordVideoView(actor, video.id)
      .then((viewCount) => {
        queryClient.setQueryData<Video | null>(
          ["video", id, viewerKey],
          (current) => (current ? { ...current, viewCount } : current),
        );
      })
      .catch(() => undefined);
  }, [actor, queryClient, video, viewerKey]);

  const navigateWithinPlaylist = useCallback(
    (nextVideo: Video, index: number) => {
      if (playlistId === null) return;
      void navigate({
        to: "/watch/$videoId",
        params: { videoId: nextVideo.id.toString() },
        search: { list: playlistId.toString(), index: index + 1 },
      });
    },
    [navigate, playlistId],
  );

  const playNext = useCallback(() => {
    if (!autoplayNext || !video || !playlistView) return;
    const currentIndex = playlistView.videos.findIndex(
      (item) => item.id === video.id,
    );
    const nextVideo = playlistView.videos[currentIndex + 1];
    if (currentIndex >= 0 && nextVideo) {
      navigateWithinPlaylist(nextVideo, currentIndex + 1);
    }
  }, [autoplayNext, navigateWithinPlaylist, playlistView, video]);

  const dismissPlaylist = useCallback(() => {
    void navigate({
      to: "/watch/$videoId",
      params: { videoId },
      search: {},
    });
  }, [navigate, videoId]);

  if (videoQuery.isError) {
    return (
      <div className="p-4 sm:p-6">
        <ErrorState
          title="Couldn't load this video"
          message="Something went wrong while fetching the video. Please try again."
          onRetry={() => void videoQuery.refetch()}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl p-4 sm:p-6">
        <Skeleton className="aspect-video w-full rounded-box" />
        <div className="mt-4 space-y-3">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <div className="flex items-center gap-3 pt-2">
            <Skeleton circle className="size-10" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!video || video.status !== VideoStatus.published) {
    return (
      <div className="p-4 sm:p-6">
        <EmptyState
          icon={<VideoOff className="size-7" aria-hidden="true" />}
          title="Video unavailable"
          description="This video doesn't exist or hasn't been published yet."
        />
      </div>
    );
  }

  const publishedDate = timestampToDate(video.publishedAt ?? video.createdAt);
  const channelName = channel?.displayName ?? channel?.username ?? "Anonymous";

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <div
        className={
          playlistId === null
            ? ""
            : "grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start"
        }
      >
        <div className="min-w-0">
          <VideoPlayer
            key={video.id.toString()}
            video={video}
            onPlay={recordFirstPlay}
            onEnded={playNext}
          />

          <div className="mt-4">
            <h1
              data-ocid="video_title"
              className="font-display text-xl font-semibold text-foreground sm:text-2xl"
            >
              {video.title}
            </h1>

            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span
                  className="flex items-center gap-1"
                  data-ocid="video_views"
                >
                  <Eye className="size-3.5" aria-hidden="true" />
                  {formatCount(video.viewCount)} views
                </span>
                <span aria-hidden="true">•</span>
                <span data-ocid="video_size">
                  {formatBytes(video.fileSize)}
                </span>
                <span aria-hidden="true">•</span>
                <span data-ocid="video_date">{timeAgo(publishedDate)}</span>
                {video.isPrivate ? (
                  <>
                    <span aria-hidden="true">•</span>
                    <span className="flex items-center gap-1 text-info">
                      <LockKeyhole className="size-3.5" aria-hidden="true" />
                      Private
                    </span>
                  </>
                ) : null}
              </div>
              <div className="flex items-center gap-1">
                <VideoActions video={video} />
                <PlaylistSaveButton video={video} />
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-4 border-y border-border py-4 sm:flex-row sm:items-center sm:justify-between">
              {channel ? (
                <Link
                  to="/channel/$userId"
                  params={{ userId: video.ownerId.toString() }}
                  data-ocid="channel_link"
                  className="group flex min-w-0 items-center gap-3"
                >
                  <Avatar
                    src={channel.avatar?.getDirectURL()}
                    name={channelName}
                    size="md"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground group-hover:text-primary">
                      {channelName}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      @{channel.username}
                    </span>
                  </span>
                </Link>
              ) : (
                <div
                  data-ocid="anonymous_channel"
                  className="flex min-w-0 items-center gap-3"
                >
                  <Avatar name="Anonymous" size="md" />
                  <span className="block truncate text-sm font-medium text-foreground">
                    Anonymous
                  </span>
                </div>
              )}

              {channel ? (
                <SubscribeButton
                  channelId={video.ownerId.toString()}
                  hidden={isOwnChannel}
                  disabled={!principal}
                />
              ) : null}
            </div>

            {video.description ? (
              <div className="mt-4 rounded-box border border-border bg-card p-4">
                <p
                  data-ocid="video_description"
                  className="whitespace-pre-wrap text-sm leading-relaxed text-foreground"
                >
                  {video.description}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {playlistId !== null ? (
          playlistQuery.isLoading ? (
            <div
              data-ocid="playlist_queue_skeleton"
              className="overflow-hidden rounded-xl border border-border bg-card"
              aria-label="Loading playlist"
            >
              <div className="space-y-3 border-b border-border p-4">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-20" />
              </div>
              <div className="space-y-2 p-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            </div>
          ) : playlistQuery.isError || !playlistView ? (
            <aside className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <ListVideo
                      className="size-4 text-brand"
                      aria-hidden="true"
                    />
                    Playlist unavailable
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    It may be private, deleted, or no longer available.
                  </p>
                  {playlistQuery.isError ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm mt-2"
                      onClick={() => void playlistQuery.refetch()}
                    >
                      Try again
                    </button>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-square"
                  aria-label="Close playlist"
                  onClick={dismissPlaylist}
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
            </aside>
          ) : (
            <PlaylistQueue
              view={playlistView}
              currentVideoId={video.id}
              autoplayNext={autoplayNext}
              onAutoplayNextChange={setAutoplayNext}
              onDismiss={dismissPlaylist}
            />
          )
        ) : null}
      </div>
    </div>
  );
}
