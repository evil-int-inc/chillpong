import { Loader } from "@/components/ui/Loader";
import type { Video } from "@/types";
import { useState } from "react";

interface VideoPlayerProps {
  video: Video;
  /** Optional poster image URL shown before playback begins. */
  poster?: string;
  /** Called the first time playback starts on the watch page. */
  onPlay?: () => void;
  /** Called when playback reaches the end of the video. */
  onEnded?: () => void;
}

/**
 * HTML5 player backed by the immutable object's direct preview URL.
 */
export function VideoPlayer({
  video,
  poster,
  onPlay,
  onEnded,
}: VideoPlayerProps) {
  const src = video.video.getDirectURL();
  const posterUrl = poster ?? video.thumbnail?.getDirectURL();
  const [isReady, setIsReady] = useState(false);

  return (
    <div
      data-ocid="video_player"
      className="relative aspect-video w-full overflow-hidden rounded-box border border-border bg-black shadow-elevated"
    >
      {!isReady ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70">
          <Loader size="lg" label="Loading video…" className="text-white" />
        </div>
      ) : null}
      <video
        data-ocid="video_element"
        src={src}
        controls
        autoPlay
        muted
        playsInline
        preload="metadata"
        poster={posterUrl}
        title={video.title}
        className="size-full object-contain"
        onCanPlay={() => setIsReady(true)}
        onLoadedData={() => setIsReady(true)}
        onError={() => setIsReady(true)}
        onPlay={onPlay}
        onEnded={onEnded}
      >
        <track kind="captions" label="Captions" />
        Your browser does not support the video tag.
      </video>
    </div>
  );
}
