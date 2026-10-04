import { PlaylistCard } from "@/components/playlist/PlaylistCard";
import type { PlaylistSummary } from "@/types";

interface PlaylistGridProps {
  playlists: PlaylistSummary[];
}

export function PlaylistGrid({ playlists }: PlaylistGridProps) {
  return (
    <div
      data-ocid="playlist_grid"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {playlists.map((playlist) => (
        <PlaylistCard key={playlist.id.toString()} playlist={playlist} />
      ))}
    </div>
  );
}
