import type { PlaylistView, Video } from "@/types";
import { formatCount } from "@/utils/format";
import { Link } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  ListVideo,
  LockKeyhole,
  Play,
  X,
} from "lucide-react";

interface PlaylistQueueProps {
  view: PlaylistView;
  currentVideoId: bigint;
  autoplayNext: boolean;
  onAutoplayNextChange: (enabled: boolean) => void;
  onDismiss: () => void;
}

function QueueNavigation({
  video,
  playlistId,
  index,
  label,
  direction,
}: {
  video?: Video;
  playlistId: bigint;
  index: number;
  label: string;
  direction: "previous" | "next";
}) {
  const Icon = direction === "previous" ? ChevronLeft : ChevronRight;
  if (!video) {
    return (
      <button
        type="button"
        className="btn btn-ghost btn-sm btn-square"
        aria-label={label}
        disabled
      >
        <Icon className="size-4" aria-hidden="true" />
      </button>
    );
  }

  return (
    <Link
      to="/watch/$videoId"
      params={{ videoId: video.id.toString() }}
      search={{ list: playlistId.toString(), index: index + 1 }}
      className="btn btn-ghost btn-sm btn-square"
      aria-label={label}
    >
      <Icon className="size-4" aria-hidden="true" />
    </Link>
  );
}

export function PlaylistQueue({
  view,
  currentVideoId,
  autoplayNext,
  onAutoplayNextChange,
  onDismiss,
}: PlaylistQueueProps) {
  const { playlist, videos } = view;
  const currentIndex = videos.findIndex((video) => video.id === currentVideoId);
  const previous = currentIndex > 0 ? videos[currentIndex - 1] : undefined;
  const next =
    currentIndex >= 0 && currentIndex < videos.length - 1
      ? videos[currentIndex + 1]
      : undefined;

  return (
    <aside
      data-ocid="playlist_queue"
      aria-label={`Playlist: ${playlist.title}`}
      className="flex max-h-[calc(100svh-6rem)] flex-col overflow-hidden rounded-xl border border-border bg-card lg:sticky lg:top-20"
    >
      <div className="border-b border-border p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ListVideo
                className="size-4 shrink-0 text-brand"
                aria-hidden="true"
              />
              <h2 className="truncate font-display font-semibold text-foreground">
                {playlist.title}
              </h2>
              {playlist.isPrivate ? (
                <LockKeyhole
                  className="size-3.5 shrink-0 text-muted-foreground"
                  aria-label="Private playlist"
                />
              ) : null}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {currentIndex >= 0 ? currentIndex + 1 : "–"} / {videos.length}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-square shrink-0"
            aria-label="Close playlist"
            onClick={onDismiss}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="toggle toggle-info toggle-xs"
              checked={autoplayNext}
              onChange={(event) => onAutoplayNextChange(event.target.checked)}
            />
            Autoplay
          </label>
          <div className="flex items-center">
            <QueueNavigation
              video={previous}
              playlistId={playlist.id}
              index={currentIndex - 1}
              label="Previous video"
              direction="previous"
            />
            <QueueNavigation
              video={next}
              playlistId={playlist.id}
              index={currentIndex + 1}
              label="Next video"
              direction="next"
            />
          </div>
        </div>
      </div>

      <ol className="min-h-0 overflow-y-auto py-1">
        {videos.map((video, index) => {
          const isCurrent = video.id === currentVideoId;
          const thumbnailUrl = video.thumbnail?.getDirectURL();
          return (
            <li key={video.id.toString()}>
              <Link
                to="/watch/$videoId"
                params={{ videoId: video.id.toString() }}
                search={{ list: playlist.id.toString(), index: index + 1 }}
                aria-current={isCurrent ? "page" : undefined}
                className={`grid grid-cols-[1.25rem_7rem_minmax(0,1fr)] items-center gap-2 px-2 py-2 transition-colors hover:bg-base-200 ${
                  isCurrent ? "bg-base-200" : ""
                }`}
              >
                <span className="flex justify-center text-xs text-muted-foreground">
                  {isCurrent ? (
                    <Play
                      className="size-3 fill-current text-brand"
                      aria-hidden="true"
                    />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="aspect-video overflow-hidden rounded-md bg-muted">
                  {thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center">
                      <Play
                        className="size-5 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </span>
                  )}
                </span>
                <span className="min-w-0 self-start py-0.5">
                  <span className="line-clamp-2 text-xs font-medium leading-snug text-foreground">
                    {video.title}
                  </span>
                  <span className="mt-1 block text-[0.6875rem] text-muted-foreground">
                    {formatCount(video.viewCount)} views
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
