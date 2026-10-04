import { Input } from "@/components/ui/Input";
import { config } from "@/config";
import type { Playlist, PlaylistSelection } from "@/types";
import { ListPlus, LockKeyhole, RefreshCw } from "lucide-react";

interface PlaylistPickerProps {
  playlists: Playlist[];
  value: PlaylistSelection | null;
  onChange: (value: PlaylistSelection | null) => void;
  error?: string;
  isLoading?: boolean;
  loadError?: boolean;
  onRetry?: () => void;
  disabled?: boolean;
}

export function PlaylistPicker({
  playlists,
  value,
  onChange,
  error,
  isLoading = false,
  loadError = false,
  onRetry,
  disabled = false,
}: PlaylistPickerProps) {
  const selectedValue =
    value?.__kind__ === "existing"
      ? `existing:${value.existing.toString()}`
      : value?.__kind__ === "new"
        ? "new"
        : "none";

  return (
    <fieldset className="rounded-box border border-border bg-card p-4">
      <legend className="px-1 text-sm font-medium text-foreground">
        Playlist{" "}
        <span className="font-normal text-muted-foreground">(optional)</span>
      </legend>

      <label htmlFor="upload-playlist" className="sr-only">
        Add video to playlist
      </label>
      <select
        id="upload-playlist"
        data-ocid="playlist_select"
        className="select select-bordered w-full bg-card"
        value={selectedValue}
        disabled={disabled || isLoading}
        onChange={(event) => {
          const selection = event.target.value;
          if (selection === "none") {
            onChange(null);
          } else if (selection === "new") {
            onChange({
              __kind__: "new",
              new: { title: "", isPrivate: false },
            });
          } else {
            onChange({
              __kind__: "existing",
              existing: BigInt(selection.slice("existing:".length)),
            });
          }
        }}
      >
        <option value="none">No playlist</option>
        {playlists.map((playlist) => (
          <option
            key={playlist.id.toString()}
            value={`existing:${playlist.id}`}
          >
            {playlist.title}
            {playlist.isPrivate ? " (Private)" : ""}
          </option>
        ))}
        <option value="new">Create a new playlist…</option>
      </select>

      {isLoading ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Loading your playlists…
        </p>
      ) : null}

      {loadError ? (
        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-error">
          <span>
            Couldn’t load your playlists. You can still upload without one.
          </span>
          {onRetry ? (
            <button
              type="button"
              className="btn btn-ghost btn-xs gap-1"
              onClick={onRetry}
            >
              <RefreshCw className="size-3" aria-hidden="true" />
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      {value?.__kind__ === "new" ? (
        <div className="mt-4 space-y-3">
          <Input
            label="New playlist name"
            data-ocid="new_playlist_title_input"
            value={value.new.title}
            maxLength={config.maxPlaylistTitleLength}
            placeholder="My playlist"
            error={error}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                __kind__: "new",
                new: {
                  ...value.new,
                  title: event.target.value,
                },
              })
            }
          />

          <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-base-200 p-3">
            <input
              type="checkbox"
              data-ocid="new_playlist_private_checkbox"
              className="checkbox checkbox-sm checkbox-info mt-0.5"
              checked={value.new.isPrivate}
              disabled={disabled}
              onChange={(event) =>
                onChange({
                  __kind__: "new",
                  new: {
                    ...value.new,
                    isPrivate: event.target.checked,
                  },
                })
              }
            />
            <span>
              <span className="flex items-center gap-1 text-sm font-medium">
                <LockKeyhole className="size-3.5" aria-hidden="true" />
                Private playlist
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Only you can open this playlist.
              </span>
            </span>
          </label>
        </div>
      ) : (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ListPlus className="size-3.5" aria-hidden="true" />
          Add this upload to one of your playlists.
        </p>
      )}
    </fieldset>
  );
}
