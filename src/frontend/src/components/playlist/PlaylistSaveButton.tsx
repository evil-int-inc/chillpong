import { createActor } from "@/backend";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { config } from "@/config";
import { useAuth } from "@/hooks/useAuth";
import { playlistService } from "@/services/playlists";
import type { Playlist, Video } from "@/types";
import { useActor } from "@caffeineai/core-infrastructure";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ListPlus, LockKeyhole, Plus, X } from "lucide-react";
import { useState } from "react";

interface PlaylistSaveButtonProps {
  video: Video;
}

export function PlaylistSaveButton({ video }: PlaylistSaveButtonProps) {
  const { actor, isFetching } = useActor(createActor);
  const { isAuthenticated, login, principal } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const queryKey = ["playlists", "mine", principal ?? "anonymous"];
  const playlistsQuery = useQuery<Playlist[]>({
    queryKey,
    queryFn: async () => {
      if (!actor) return [];
      return playlistService.getMyPlaylists(actor);
    },
    enabled: isOpen && isAuthenticated && !!actor && !isFetching,
  });

  const updatePlaylist = async (playlist: Playlist, shouldContain: boolean) => {
    if (!actor) return;
    setPendingId(playlist.id.toString());
    setError(null);
    try {
      const updated = shouldContain
        ? await playlistService.addVideo(actor, playlist.id, video.id)
        : await playlistService.removeVideo(actor, playlist.id, video.id);
      queryClient.setQueryData<Playlist[]>(queryKey, (current = []) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      await queryClient.invalidateQueries({
        queryKey: ["playlist", playlist.id.toString()],
      });
      await queryClient.invalidateQueries({ queryKey: ["channel-playlists"] });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Couldn't update playlist",
      );
    } finally {
      setPendingId(null);
    }
  };

  const createPlaylist = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = title.trim();
    if (!name) {
      setError("Playlist name is required.");
      return;
    }
    if (!actor) return;
    setPendingId("new");
    setError(null);
    try {
      const created = await playlistService.createPlaylist(
        actor,
        name,
        isPrivate,
        video.id,
      );
      queryClient.setQueryData<Playlist[]>(queryKey, (current = []) => [
        created,
        ...current,
      ]);
      await queryClient.invalidateQueries({ queryKey: ["channel-playlists"] });
      setTitle("");
      setIsPrivate(false);
      setIsCreating(false);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Couldn't create playlist",
      );
    } finally {
      setPendingId(null);
    }
  };

  return (
    <>
      <button
        type="button"
        data-ocid="save_to_playlist_button"
        className="btn btn-ghost btn-sm gap-2"
        onClick={() => {
          if (!isAuthenticated) {
            login();
            return;
          }
          setIsOpen(true);
        }}
      >
        <ListPlus className="size-4" aria-hidden="true" />
        Save
      </button>

      {isOpen ? (
        <dialog
          open
          className="modal modal-open"
          aria-labelledby="save-playlist-title"
        >
          <div className="modal-box max-w-sm rounded-xl">
            <div className="flex items-center justify-between gap-3">
              <h2
                id="save-playlist-title"
                className="font-display text-lg font-semibold"
              >
                Save to playlist
              </h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-square"
                aria-label="Close save dialog"
                onClick={() => setIsOpen(false)}
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            {playlistsQuery.isLoading ? (
              <span
                className="loading loading-spinner loading-sm mt-5"
                aria-label="Loading playlists"
              />
            ) : playlistsQuery.isError ? (
              <div className="mt-4 text-sm text-error">
                <p>Couldn’t load your playlists.</p>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm mt-2"
                  onClick={() => void playlistsQuery.refetch()}
                >
                  Try again
                </button>
              </div>
            ) : (
              <div className="mt-4 max-h-64 space-y-1 overflow-y-auto">
                {(playlistsQuery.data ?? []).map((playlist) => {
                  const containsVideo = playlist.videoIds.some(
                    (id) => id === video.id,
                  );
                  return (
                    <label
                      key={playlist.id.toString()}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-base-200"
                    >
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm checkbox-info"
                        checked={containsVideo}
                        disabled={pendingId !== null}
                        onChange={(event) =>
                          void updatePlaylist(playlist, event.target.checked)
                        }
                      />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {playlist.title}
                      </span>
                      {playlist.isPrivate ? (
                        <LockKeyhole
                          className="size-3.5 text-muted-foreground"
                          aria-label="Private"
                        />
                      ) : null}
                      {containsVideo ? (
                        <Check
                          className="size-3.5 text-success"
                          aria-hidden="true"
                        />
                      ) : null}
                    </label>
                  );
                })}
                {(playlistsQuery.data ?? []).length === 0 ? (
                  <p className="py-3 text-sm text-muted-foreground">
                    You don’t have any playlists yet.
                  </p>
                ) : null}
              </div>
            )}

            {error ? <p className="mt-3 text-sm text-error">{error}</p> : null}

            {isCreating ? (
              <form
                className="mt-4 space-y-3 border-t border-border pt-4"
                onSubmit={createPlaylist}
              >
                <Input
                  label="Playlist name"
                  value={title}
                  maxLength={config.maxPlaylistTitleLength}
                  onChange={(event) => setTitle(event.target.value)}
                  autoFocus
                />
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm checkbox-info"
                    checked={isPrivate}
                    onChange={(event) => setIsPrivate(event.target.checked)}
                  />
                  Private playlist
                </label>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsCreating(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" loading={pendingId === "new"}>
                    Create
                  </Button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                className="btn btn-ghost btn-sm mt-4 gap-2"
                onClick={() => setIsCreating(true)}
              >
                <Plus className="size-4" aria-hidden="true" />
                New playlist
              </button>
            )}
          </div>
          <button
            type="button"
            className="modal-backdrop"
            aria-label="Close save dialog"
            onClick={() => setIsOpen(false)}
          />
        </dialog>
      ) : null}
    </>
  );
}
