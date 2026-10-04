import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { mediaActionService } from "@/services/media-actions";
import type { Video } from "@/types";
import { AlignLeft, Check, Download, ImageDown, Type } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface VideoActionsProps {
  video: Video;
  compact?: boolean;
  className?: string;
}

type CopiedField = "title" | "description" | null;

/** Download and clipboard actions shared by video cards and the watch page. */
export function VideoActions({
  video,
  compact = false,
  className,
}: VideoActionsProps) {
  const [copiedField, setCopiedField] = useState<CopiedField>(null);
  const resetTimerRef = useRef<number | null>(null);
  const videoUrl = video.video.getDirectURL();
  const previewUrl = video.thumbnail?.getDirectURL() ?? null;

  useEffect(
    () => () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    },
    [],
  );

  const copy = async (field: Exclude<CopiedField, null>, value: string) => {
    await mediaActionService.copyText(value);
    setCopiedField(field);
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => setCopiedField(null), 1600);
  };

  const iconClass = compact ? "size-3.5" : "size-4";

  return (
    <div
      data-ocid="video_actions"
      className={cn("flex items-center gap-1", className)}
    >
      <div className="tooltip tooltip-top" data-tip="Download video">
        <Button
          variant="ghost"
          size="icon"
          className={compact ? "btn-xs" : undefined}
          aria-label="Download video"
          data-ocid="download_video_button"
          onClick={() => mediaActionService.download(videoUrl, video.filename)}
        >
          <Download className={iconClass} aria-hidden="true" />
        </Button>
      </div>

      <div
        className="tooltip tooltip-top"
        data-tip={previewUrl ? "Download preview" : "No preview available"}
      >
        <Button
          variant="ghost"
          size="icon"
          className={compact ? "btn-xs" : undefined}
          aria-label="Download video preview"
          data-ocid="download_preview_button"
          disabled={!previewUrl}
          onClick={() => {
            if (previewUrl) {
              mediaActionService.download(
                previewUrl,
                video.thumbnail?.filename ?? `${video.filename}-preview`,
              );
            }
          }}
        >
          <ImageDown className={iconClass} aria-hidden="true" />
        </Button>
      </div>

      <div
        className="tooltip tooltip-top"
        data-tip={copiedField === "title" ? "Title copied" : "Copy title"}
      >
        <Button
          variant="ghost"
          size="icon"
          className={compact ? "btn-xs" : undefined}
          aria-label="Copy video title"
          data-ocid="copy_title_button"
          onClick={() => void copy("title", video.title).catch(() => undefined)}
        >
          {copiedField === "title" ? (
            <Check className={iconClass} aria-hidden="true" />
          ) : (
            <Type className={iconClass} aria-hidden="true" />
          )}
        </Button>
      </div>

      <div
        className="tooltip tooltip-top"
        data-tip={
          !video.description
            ? "No description available"
            : copiedField === "description"
              ? "Description copied"
              : "Copy description"
        }
      >
        <Button
          variant="ghost"
          size="icon"
          className={compact ? "btn-xs" : undefined}
          aria-label="Copy video description"
          data-ocid="copy_description_button"
          disabled={!video.description}
          onClick={() => {
            if (video.description) {
              void copy("description", video.description).catch(
                () => undefined,
              );
            }
          }}
        >
          {copiedField === "description" ? (
            <Check className={iconClass} aria-hidden="true" />
          ) : (
            <AlignLeft className={iconClass} aria-hidden="true" />
          )}
        </Button>
      </div>
    </div>
  );
}
