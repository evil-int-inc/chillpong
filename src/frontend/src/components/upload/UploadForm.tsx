import { PlaylistPicker } from "@/components/playlist/PlaylistPicker";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { config } from "@/config";
import type { Playlist, PlaylistSelection } from "@/types";
import { formatBytes } from "@/utils/format";
import { Clapperboard, ImagePlus, UploadCloud, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface UploadFormValues {
  file: File;
  title: string;
  description?: string;
  isPrivate: boolean;
  playlist: PlaylistSelection | null;
  /** Optional thumbnail image uploaded to immutable object storage. */
  thumbnail?: File | null;
}

interface UploadFormProps {
  onSubmit: (values: UploadFormValues) => void;
  disabled?: boolean;
  playlists?: Playlist[];
  playlistsLoading?: boolean;
  playlistsError?: boolean;
  onRetryPlaylists?: () => void;
}

interface FieldErrors {
  title?: string;
  video?: string;
  thumbnail?: string;
  playlist?: string;
}

function validateVideo(file: File): string | undefined {
  if (file.size > config.maxVideoSizeBytes) {
    return `Video exceeds the ${formatBytes(config.maxVideoSizeBytes)} limit.`;
  }
  if (
    !(config.acceptedVideoMimeTypes as readonly string[]).includes(file.type)
  ) {
    return "Unsupported video format. Use MP4, WebM, or MOV.";
  }
  return undefined;
}

function validateThumbnail(file: File): string | undefined {
  if (file.size > config.maxThumbnailSizeBytes) {
    return `Thumbnail exceeds the ${formatBytes(
      config.maxThumbnailSizeBytes,
    )} limit.`;
  }
  if (
    !(config.acceptedThumbnailMimeTypes as readonly string[]).includes(
      file.type,
    )
  ) {
    return "Unsupported image format. Use JPEG, PNG, or WebP.";
  }
  return undefined;
}

export function UploadForm({
  onSubmit,
  disabled,
  playlists = [],
  playlistsLoading = false,
  playlistsError = false,
  onRetryPlaylists,
}: UploadFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [playlist, setPlaylist] = useState<PlaylistSelection | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!videoFile || typeof URL.createObjectURL !== "function") {
      setVideoPreviewUrl(null);
      return;
    }
    const previewUrl = URL.createObjectURL(videoFile);
    setVideoPreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [videoFile]);

  const handleVideoChange = (file: File | undefined) => {
    if (!file) return;
    setVideoFile(file);
    setErrors((prev) => ({ ...prev, video: validateVideo(file) }));
  };

  const handleThumbnailChange = (file: File | undefined) => {
    if (!file) return;
    setThumbnailFile(file);
    setErrors((prev) => ({ ...prev, thumbnail: validateThumbnail(file) }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: FieldErrors = {};
    if (!title.trim()) nextErrors.title = "Title is required.";
    if (!videoFile) nextErrors.video = "Choose a video to upload.";
    else nextErrors.video = validateVideo(videoFile);
    if (thumbnailFile) nextErrors.thumbnail = validateThumbnail(thumbnailFile);
    if (playlist?.__kind__ === "new" && !playlist.new.title.trim()) {
      nextErrors.playlist = "Playlist name is required.";
    }
    setErrors(nextErrors);
    if (
      nextErrors.title ||
      nextErrors.video ||
      nextErrors.thumbnail ||
      nextErrors.playlist
    )
      return;
    onSubmit({
      file: videoFile as File,
      title: title.trim(),
      description: description.trim() || undefined,
      isPrivate,
      playlist:
        playlist?.__kind__ === "new"
          ? {
              __kind__: "new",
              new: {
                ...playlist.new,
                title: playlist.new.title.trim(),
              },
            }
          : playlist,
      thumbnail: thumbnailFile,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      data-ocid="upload_form"
      className="flex flex-col gap-6"
      noValidate
    >
      {/* Video file picker */}
      <div>
        <span className="mb-1.5 block text-sm font-medium text-foreground">
          Video file
        </span>
        <input
          ref={videoInputRef}
          type="file"
          accept={config.acceptedVideoMimeTypes.join(",")}
          data-ocid="video_input"
          className="hidden"
          onChange={(e) => handleVideoChange(e.target.files?.[0])}
        />
        {videoFile ? (
          <div data-ocid="video_file" className="space-y-3">
            {videoPreviewUrl ? (
              <video
                data-ocid="video_preview"
                src={videoPreviewUrl}
                controls
                preload="metadata"
                className="aspect-video w-full rounded-box border border-border bg-black object-contain"
              >
                <track kind="captions" label="Captions" />
              </video>
            ) : null}
            <div className="flex items-center gap-3 rounded-box border border-border bg-card p-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Clapperboard className="size-6" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {videoFile.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(videoFile.size)}
                </p>
              </div>
              <button
                type="button"
                data-ocid="remove_video_button"
                aria-label="Remove video"
                className="btn btn-ghost btn-sm btn-square text-muted-foreground"
                onClick={() => {
                  setVideoFile(null);
                  setErrors((prev) => ({ ...prev, video: undefined }));
                  if (videoInputRef.current) videoInputRef.current.value = "";
                }}
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            data-ocid="video_dropzone"
            onClick={() => videoInputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-box border-2 border-dashed border-border bg-card px-6 py-10 text-center transition-smooth hover:border-primary/60 hover:bg-muted/40"
          >
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UploadCloud className="size-6" aria-hidden="true" />
            </div>
            <span className="font-display text-sm font-semibold text-foreground">
              Choose a video to upload
            </span>
            <span className="text-xs text-muted-foreground">
              MP4, WebM, or MOV up to {formatBytes(config.maxVideoSizeBytes)}
            </span>
          </button>
        )}
        {errors.video ? (
          <p
            data-ocid="video_error"
            className="mt-1.5 text-sm text-destructive"
          >
            {errors.video}
          </p>
        ) : null}
      </div>

      {/* Title */}
      <Input
        label="Title"
        data-ocid="title_input"
        placeholder="Give your video a title"
        value={title}
        maxLength={config.maxTitleLength}
        error={errors.title}
        onChange={(e) => {
          setTitle(e.target.value);
          if (errors.title)
            setErrors((prev) => ({ ...prev, title: undefined }));
        }}
      />

      {/* Description */}
      <div>
        <label
          htmlFor="upload-description"
          className="mb-1.5 block text-sm font-medium text-foreground"
        >
          Description
        </label>
        <textarea
          id="upload-description"
          data-ocid="description_textarea"
          rows={4}
          maxLength={config.maxDescriptionLength}
          placeholder="Tell viewers what this video is about"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="textarea textarea-bordered w-full resize-y bg-card text-foreground transition-smooth focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="mt-1.5 text-right text-xs text-muted-foreground">
          {description.length}/{config.maxDescriptionLength}
        </p>
      </div>

      {/* Visibility */}
      <label className="flex cursor-pointer items-start gap-3 rounded-box border border-border bg-card p-4">
        <input
          type="checkbox"
          data-ocid="private_checkbox"
          className="checkbox checkbox-info mt-0.5"
          checked={isPrivate}
          onChange={(event) => setIsPrivate(event.target.checked)}
        />
        <span>
          <span className="block text-sm font-medium text-foreground">
            Private video
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {isPrivate
              ? "Only you can find and watch this video."
              : "Public videos appear in feeds and subscriptions."}
          </span>
        </span>
      </label>

      <PlaylistPicker
        playlists={playlists}
        value={playlist}
        error={errors.playlist}
        isLoading={playlistsLoading}
        loadError={playlistsError}
        onRetry={onRetryPlaylists}
        disabled={disabled}
        onChange={(nextPlaylist) => {
          setPlaylist(nextPlaylist);
          if (errors.playlist) {
            setErrors((prev) => ({ ...prev, playlist: undefined }));
          }
        }}
      />

      {/* Optional thumbnail */}
      <div>
        <span className="mb-1.5 block text-sm font-medium text-foreground">
          Thumbnail{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </span>
        <input
          ref={thumbnailInputRef}
          type="file"
          accept={config.acceptedThumbnailMimeTypes.join(",")}
          data-ocid="thumbnail_input"
          className="hidden"
          onChange={(e) => handleThumbnailChange(e.target.files?.[0])}
        />
        {thumbnailFile ? (
          <div
            data-ocid="thumbnail_file"
            className="flex items-center gap-3 rounded-box border border-border bg-card p-4"
          >
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <ImagePlus className="size-6" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {thumbnailFile.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatBytes(thumbnailFile.size)}
              </p>
            </div>
            <button
              type="button"
              data-ocid="remove_thumbnail_button"
              aria-label="Remove thumbnail"
              className="btn btn-ghost btn-sm btn-square text-muted-foreground"
              onClick={() => {
                setThumbnailFile(null);
                setErrors((prev) => ({ ...prev, thumbnail: undefined }));
                if (thumbnailInputRef.current)
                  thumbnailInputRef.current.value = "";
              }}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            data-ocid="thumbnail_dropzone"
            onClick={() => thumbnailInputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-box border border-dashed border-border bg-card px-4 py-4 text-sm text-muted-foreground transition-smooth hover:border-primary/60 hover:text-foreground"
          >
            <ImagePlus className="size-4" aria-hidden="true" />
            Add a thumbnail (JPEG, PNG, or WebP up to{" "}
            {formatBytes(config.maxThumbnailSizeBytes)})
          </button>
        )}
        {errors.thumbnail ? (
          <p
            data-ocid="thumbnail_error"
            className="mt-1.5 text-sm text-destructive"
          >
            {errors.thumbnail}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-border pt-5">
        <Button
          type="submit"
          data-ocid="submit_button"
          size="lg"
          disabled={disabled}
        >
          Upload video
        </Button>
      </div>
    </form>
  );
}
