import type { Backend } from "@/backend";
import type {
  Cursor,
  Playlist,
  PlaylistPage,
  PlaylistView,
  UserId,
} from "@/types";
import { toPlaylistPage } from "@/types";

/** Backend operations for playlist creation, membership, and public reads. */
export class PlaylistService {
  getMyPlaylists(actor: Backend): Promise<Playlist[]> {
    return actor.getMyPlaylists();
  }

  async getChannelPlaylists(
    actor: Backend,
    userId: UserId,
    cursor: Cursor,
    limit: bigint,
  ): Promise<PlaylistPage> {
    return toPlaylistPage(
      await actor.getChannelPlaylists(userId, cursor, limit),
    );
  }

  getPlaylist(
    actor: Backend,
    playlistId: bigint,
  ): Promise<PlaylistView | null> {
    return actor.getPlaylist(playlistId);
  }

  createPlaylist(
    actor: Backend,
    title: string,
    isPrivate: boolean,
    initialVideoId: bigint | null = null,
  ): Promise<Playlist> {
    return actor.createPlaylist(title, isPrivate, initialVideoId);
  }

  addVideo(
    actor: Backend,
    playlistId: bigint,
    videoId: bigint,
  ): Promise<Playlist> {
    return actor.addVideoToPlaylist(playlistId, videoId);
  }

  removeVideo(
    actor: Backend,
    playlistId: bigint,
    videoId: bigint,
  ): Promise<Playlist> {
    return actor.removeVideoFromPlaylist(playlistId, videoId);
  }
}

export const playlistService = new PlaylistService();
