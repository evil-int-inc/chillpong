import type { PlaylistSummary } from "@/types";
import { Link } from "@tanstack/react-router";
import { ListVideo, LockKeyhole, Play } from "lucide-react";

interface PlaylistCardProps {
  playlist: PlaylistSummary;
}

export function PlaylistCard({ playlist }: PlaylistCardProps) {
  const thumbnailUrl = playlist.thumbnail?.getDirectURL();
  const card = (
    <article
      data-ocid="playlist_card"
      className="group h-full overflow-hidden rounded-xl border border-border bg-card transition-smooth hover:shadow-elevated"
    >
      <div className="relative aspect-video overflow-hidden bg-muted">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-subtle text-muted-foreground">
            <ListVideo className="size-10" aria-hidden="true" />
          </div>
        )}

        <span className="absolute inset-y-0 right-0 flex w-2/5 flex-col items-center justify-center gap-1 bg-black/75 text-white">
          <span className="text-lg font-semibold">
            {playlist.videoCount.toString()}
          </span>
          <ListVideo className="size-5" aria-hidden="true" />
        </span>

        {playlist.firstVideoId !== undefined ? (
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/25 group-hover:opacity-100">
            <span className="flex items-center gap-2 rounded-full bg-black/80 px-3 py-1.5 text-xs font-medium text-white">
              <Play className="size-3.5 fill-current" aria-hidden="true" />
              Play all
            </span>
          </span>
        ) : null}

        {playlist.isPrivate ? (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-black/80 px-2 py-1 text-xs font-medium text-white">
            <LockKeyhole className="size-3" aria-hidden="true" />
            Private
          </span>
        ) : null}
      </div>

      <div className="p-3">
        <h3 className="line-clamp-2 font-display text-sm font-semibold text-foreground">
          {playlist.title}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {playlist.videoCount.toString()}{" "}
          {playlist.videoCount === 1n ? "video" : "videos"}
        </p>
      </div>
    </article>
  );

  return playlist.firstVideoId !== undefined ? (
    <Link
      to="/watch/$videoId"
      params={{ videoId: playlist.firstVideoId.toString() }}
      search={{ list: playlist.id.toString(), index: 1 }}
      aria-label={`Play playlist ${playlist.title}`}
      className="block h-full rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      {card}
    </Link>
  ) : (
    card
  );
}
