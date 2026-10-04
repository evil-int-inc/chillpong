import type { Backend } from "@/backend";
import type { Cursor, Page, UserId, Video } from "@/types";
import { toPage } from "@/types";

/** Backend operations for videos and video feeds. */
export class VideoService {
  /** Fetches a cursor-paginated page of the global feed. */
  async getFeed(
    actor: Backend,
    cursor: Cursor,
    limit: bigint,
  ): Promise<Page<Video>> {
    return toPage(await actor.getFeed(cursor, limit));
  }

  /** Fetches a cursor-paginated page of the subscription feed. */
  async getSubscriptionFeed(
    actor: Backend,
    cursor: Cursor,
    limit: bigint,
  ): Promise<Page<Video>> {
    return toPage(await actor.getSubscriptionFeed(cursor, limit));
  }

  /** Fetches a cursor-paginated page of a channel's videos. */
  async getChannelVideos(
    actor: Backend,
    userId: UserId,
    cursor: Cursor,
    limit: bigint,
  ): Promise<Page<Video>> {
    return toPage(await actor.getChannelVideos(userId, cursor, limit));
  }

  /** Fetches a cursor-paginated page of the caller's own videos. */
  async getMyVideos(
    actor: Backend,
    cursor: Cursor,
    limit: bigint,
  ): Promise<Page<Video>> {
    return toPage(await actor.getMyVideos(cursor, limit));
  }

  /** Fetches a single video by id. */
  getVideo(actor: Backend, videoId: bigint): Promise<Video | null> {
    return actor.getVideo(videoId);
  }

  /** Records the first playback and returns the durable view count. */
  recordVideoView(actor: Backend, videoId: bigint): Promise<bigint> {
    return actor.recordVideoView(videoId);
  }

  /** Deletes a video owned by the caller. */
  deleteVideo(actor: Backend, videoId: bigint): Promise<void> {
    return actor.deleteVideo(videoId);
  }

  /** Publishes a draft video. */
  publishVideo(actor: Backend, videoId: bigint): Promise<Video> {
    return actor.publishVideo(videoId);
  }
}

export const videoService = new VideoService();
