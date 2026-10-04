import { createActor } from "@/backend";
import { InfiniteScrollSentinel } from "@/components/common/InfiniteScrollSentinel";
import { PlaylistGrid } from "@/components/playlist/PlaylistGrid";
import { SubscribeButton } from "@/components/subscription/SubscribeButton";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Loader } from "@/components/ui/Loader";
import { Skeleton } from "@/components/ui/Skeleton";
import { VideoGrid } from "@/components/video/VideoGrid";
import { config } from "@/config";
import { useAuth } from "@/hooks/useAuth";
import { useInfinitePlaylists } from "@/hooks/useInfinitePlaylists";
import { useInfiniteVideos } from "@/hooks/useInfiniteVideos";
import { playlistService } from "@/services/playlists";
import { userService } from "@/services/users";
import { videoService } from "@/services/videos";
import { formatDate, timestampToDate } from "@/utils/format";
import { useActor } from "@caffeineai/core-infrastructure";
import { Principal } from "@icp-sdk/core/principal";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { Clapperboard, ListVideo } from "lucide-react";
import { useCallback } from "react";

/** Layout-matched skeleton for the channel header while the profile loads. */
function ChannelHeaderSkeleton() {
  return (
    <div
      data-ocid="channel_header_skeleton"
      className="flex flex-col gap-4 rounded-box border border-border bg-card p-6 sm:flex-row sm:items-center"
      aria-hidden="true"
    >
      <Skeleton circle className="size-20 shrink-0" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-10 w-32" />
    </div>
  );
}

/** Stable keys for skeleton placeholders (avoids array-index keys). */
const CHANNEL_SKELETON_KEYS = Array.from(
  { length: config.channelPageSize },
  (_, i) => `channel-skeleton-${i}`,
);

/** Layout-matched skeleton grid shown while the first video page loads. */
function ChannelVideosSkeleton() {
  return (
    <div
      data-ocid="channel_videos_skeleton"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-hidden="true"
    >
      {CHANNEL_SKELETON_KEYS.map((key) => (
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

function ChannelPlaylistsSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-hidden="true"
    >
      {CHANNEL_SKELETON_KEYS.slice(0, 6).map((key) => (
        <div
          key={`playlist-${key}`}
          className="overflow-hidden rounded-xl border border-border bg-card"
        >
          <Skeleton className="aspect-video w-full rounded-none" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Public channel page at /channel/$userId. Shows the channel profile header
 * (avatar, name, username, bio, member-since date, subscriber count) with a
 * subscribe button, followed by the channel's published videos with cursor
 * pagination and infinite scroll.
 */
export function ChannelPage() {
  const { userId } = useParams({ from: "/channel/$userId" });
  const { tab } = useSearch({ from: "/channel/$userId" });
  const navigate = useNavigate();
  const activeTab = tab === "playlists" ? "playlists" : "videos";
  const channelPrincipal = Principal.fromText(userId);
  const { actor, isFetching } = useActor(createActor);
  const { principal } = useAuth();

  const isOwnChannel = principal === userId;

  const channelQuery = useQuery({
    queryKey: ["channel", userId],
    queryFn: async () => {
      if (!actor) return null;
      return userService.getChannel(actor, channelPrincipal);
    },
    enabled: !!actor && !isFetching,
  });

  const channel = channelQuery.data;

  const avatarUrl = channel?.avatar?.getDirectURL() ?? null;

  const fetcher = useCallback(
    (cursor: bigint, limit: bigint) => {
      if (!actor) return Promise.resolve({ items: [] });
      return videoService.getChannelVideos(
        actor,
        channelPrincipal,
        cursor,
        limit,
      );
    },
    [actor, channelPrincipal],
  );

  const { items, hasMore, loadMore, reset, isLoading, error } =
    useInfiniteVideos({
      fetcher,
      pageSize: config.channelPageSize,
      enabled: activeTab === "videos" && !!actor && !isFetching,
    });

  const playlistFetcher = useCallback(
    (cursor: bigint, limit: bigint) => {
      if (!actor) return Promise.resolve({ items: [] });
      return playlistService.getChannelPlaylists(
        actor,
        channelPrincipal,
        cursor,
        limit,
      );
    },
    [actor, channelPrincipal],
  );

  const playlists = useInfinitePlaylists({
    fetcher: playlistFetcher,
    pageSize: config.playlistPageSize,
    enabled: activeTab === "playlists" && !!actor && !isFetching,
  });

  const initialLoading = isLoading && items.length === 0 && !error;
  const memberSince = timestampToDate(channel?.createdAt ?? 0n);

  const selectTab = (nextTab: "videos" | "playlists") => {
    void navigate({
      to: "/channel/$userId",
      params: { userId },
      search: nextTab === "playlists" ? { tab: "playlists" } : {},
    });
  };

  return (
    <section
      data-ocid="channel_page"
      className="flex flex-col gap-6 p-4 sm:p-6"
    >
      {channelQuery.isLoading ? (
        <ChannelHeaderSkeleton />
      ) : channelQuery.isError || !channel ? (
        <ErrorState
          title="Couldn't load this channel"
          message={
            channelQuery.error instanceof Error
              ? channelQuery.error.message
              : "This channel may not exist or is unavailable."
          }
          onRetry={() => void channelQuery.refetch()}
        />
      ) : (
        <header
          data-ocid="channel_header"
          className="flex flex-col gap-4 rounded-box border border-border bg-card p-6 sm:flex-row sm:items-center"
        >
          <Avatar
            src={avatarUrl ?? undefined}
            name={channel.displayName}
            size="xl"
            className="size-20 text-2xl"
          />

          <div className="flex flex-1 flex-col gap-1.5">
            <h1 className="font-display text-2xl font-bold text-foreground">
              {channel.displayName}
            </h1>
            <p className="text-sm text-muted-foreground">
              @{channel.username}
              {memberSince ? (
                <>
                  <span aria-hidden="true" className="mx-1.5">
                    ·
                  </span>
                  Joined {formatDate(memberSince)}
                </>
              ) : null}
            </p>
            {channel.bio ? (
              <p className="max-w-2xl text-sm text-muted-foreground">
                {channel.bio}
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <SubscribeButton
              channelId={userId}
              hidden={isOwnChannel}
              disabled={!principal}
            />
          </div>
        </header>
      )}

      <div
        role="tablist"
        aria-label="Channel content"
        className="tabs tabs-border border-b border-border"
      >
        <button
          type="button"
          role="tab"
          id="channel-videos-tab"
          aria-controls="channel-videos-panel"
          aria-selected={activeTab === "videos"}
          className={`tab gap-2 ${activeTab === "videos" ? "tab-active" : ""}`}
          onClick={() => selectTab("videos")}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight" || event.key === "End") {
              event.preventDefault();
              selectTab("playlists");
            }
          }}
        >
          <Clapperboard className="size-4" aria-hidden="true" />
          Videos
        </button>
        <button
          type="button"
          role="tab"
          id="channel-playlists-tab"
          aria-controls="channel-playlists-panel"
          aria-selected={activeTab === "playlists"}
          className={`tab gap-2 ${activeTab === "playlists" ? "tab-active" : ""}`}
          onClick={() => selectTab("playlists")}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "Home") {
              event.preventDefault();
              selectTab("videos");
            }
          }}
        >
          <ListVideo className="size-4" aria-hidden="true" />
          Playlists
        </button>
      </div>

      {activeTab === "videos" ? (
        <div
          id="channel-videos-panel"
          role="tabpanel"
          aria-labelledby="channel-videos-tab"
          className="flex flex-col gap-4"
        >
          {error && items.length === 0 ? (
            <ErrorState
              title="Couldn't load this channel's videos"
              message={error.message}
              onRetry={reset}
            />
          ) : initialLoading ? (
            <ChannelVideosSkeleton />
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Clapperboard className="size-7" aria-hidden="true" />}
              title="No videos yet"
              description="This channel hasn't published any videos yet. Check back soon."
            />
          ) : (
            <>
              <VideoGrid videos={items} channelName={channel?.displayName} />

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
        </div>
      ) : (
        <div
          id="channel-playlists-panel"
          role="tabpanel"
          aria-labelledby="channel-playlists-tab"
          className="flex flex-col gap-4"
        >
          {playlists.error && playlists.items.length === 0 ? (
            <ErrorState
              title="Couldn't load this channel's playlists"
              message={playlists.error.message}
              onRetry={playlists.reset}
            />
          ) : playlists.isLoading && playlists.items.length === 0 ? (
            <ChannelPlaylistsSkeleton />
          ) : playlists.items.length === 0 ? (
            <EmptyState
              icon={<ListVideo className="size-7" aria-hidden="true" />}
              title="No playlists yet"
              description="This channel hasn't shared any playlists yet."
            />
          ) : (
            <>
              <PlaylistGrid playlists={playlists.items} />
              <InfiniteScrollSentinel
                onIntersect={() => void playlists.loadMore()}
                disabled={!playlists.hasMore || playlists.isLoading}
              />
              {playlists.isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader label="Loading more playlists" />
                </div>
              ) : null}
            </>
          )}
        </div>
      )}
    </section>
  );
}
