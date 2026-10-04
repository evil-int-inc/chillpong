import {
  type Backend,
  type CreateVideoResult,
  ExternalBlob,
  type PlaylistSelection,
} from "@/backend";
import { config } from "@/config";
import { videoService } from "@/services/videos";
import type { Video } from "@/types";

/** Immutable object-storage upload and video publication. */
export class UploadService {
  /** Creates a draft backed by real object-storage references. */
  createVideo(
    actor: Backend,
    title: string,
    description: string | null,
    video: ExternalBlob,
    thumbnail: ExternalBlob | null,
    filename: string,
    mimeType: string,
    fileSize: bigint,
    isPrivate: boolean,
    playlist: PlaylistSelection | null,
  ): Promise<CreateVideoResult> {
    return actor.createVideo(
      title,
      description,
      video,
      thumbnail,
      filename,
      mimeType,
      fileSize,
      isPrivate,
      playlist,
    );
  }

  private async toExternalBlob(
    file: File,
    onProgress?: (percentage: number) => void,
  ): Promise<ExternalBlob> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return ExternalBlob.fromBytes(
      bytes,
      file.type,
      file.name,
    ).withUploadProgress((percentage) => onProgress?.(percentage));
  }

  /** Uploads video/thumbnail bytes to object storage and publishes the record. */
  async uploadVideo(
    actor: Backend,
    file: File,
    title: string,
    description: string | null,
    thumbnail: File | null,
    isPrivate: boolean,
    playlist: PlaylistSelection | null,
    onProgress?: (percentage: number) => void,
  ): Promise<{ video: Video; playlistId?: bigint }> {
    if (file.size === 0) {
      throw new Error("Choose a video that is not empty");
    }
    if (file.size > config.maxVideoSizeBytes) {
      throw new Error(
        `Video exceeds the maximum size of ${config.maxVideoSizeBytes} bytes`,
      );
    }
    if (
      !(config.acceptedVideoMimeTypes as readonly string[]).includes(file.type)
    ) {
      throw new Error("Unsupported video format");
    }
    if (thumbnail) {
      if (thumbnail.size > config.maxThumbnailSizeBytes) {
        throw new Error(
          `Thumbnail exceeds the maximum size of ${config.maxThumbnailSizeBytes} bytes`,
        );
      }
      if (
        !(config.acceptedThumbnailMimeTypes as readonly string[]).includes(
          thumbnail.type,
        )
      ) {
        throw new Error("Unsupported thumbnail format");
      }
    }

    onProgress?.(0);
    const videoProgressWeight = thumbnail ? 90 : 100;
    const videoBlob = await this.toExternalBlob(file, (percentage) => {
      onProgress?.(Math.round((percentage * videoProgressWeight) / 100));
    });
    const thumbnailBlob = thumbnail
      ? await this.toExternalBlob(thumbnail, (percentage) => {
          onProgress?.(
            videoProgressWeight +
              Math.round((percentage * (100 - videoProgressWeight)) / 100),
          );
        })
      : null;

    const draft = await this.createVideo(
      actor,
      title,
      description,
      videoBlob,
      thumbnailBlob,
      file.name,
      file.type,
      BigInt(file.size),
      isPrivate,
      playlist,
    );

    const published = await videoService.publishVideo(actor, draft.video.id);
    return { video: published, playlistId: draft.playlistId };
  }
}

export const uploadService = new UploadService();
