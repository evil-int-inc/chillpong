import { type Backend, ExternalBlob } from "@/backend";
import { uploadService } from "@/services/upload";
import { VideoStatus } from "@/types";
import type { Video } from "@/types";
import { describe, expect, it, vi } from "vitest";

function makeDraft(id: bigint, title: string, isPrivate = false): Video {
  return {
    id,
    title,
    status: VideoStatus.draft,
    ownerId: "aaaaa-aa" as unknown as Video["ownerId"],
    createdAt: 0n,
    video: ExternalBlob.fromURL("https://example.com/video"),
    filename: "clip.mp4",
    mimeType: "video/mp4",
    fileSize: 100n,
    viewCount: 0n,
    isPrivate,
  };
}

function makePublished(id: bigint, title: string, isPrivate = false): Video {
  return {
    ...makeDraft(id, title, isPrivate),
    status: VideoStatus.published,
    publishedAt: 1n,
  };
}

function makeFile(size: number, type = "video/mp4", name = "clip.mp4"): File {
  const bytes = new Uint8Array(Math.min(size, 1_024));
  const file = new File([bytes], name, { type });
  Object.defineProperty(file, "size", { value: size });
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => bytes.buffer,
  });
  return file;
}

describe("uploadVideo", () => {
  it("uploads immutable blobs, creates a draft, and publishes it", async () => {
    const createVideo = vi.fn<Backend["createVideo"]>(async () => ({
      video: makeDraft(1n, "My clip"),
    }));
    const publishVideo = vi.fn(async () => makePublished(1n, "My clip"));
    const actor = { createVideo, publishVideo } as unknown as Backend;

    const result = await uploadService.uploadVideo(
      actor,
      makeFile(100),
      "My clip",
      "A description",
      null,
      false,
      null,
    );

    expect(result.video.status).toBe(VideoStatus.published);
    expect(result.playlistId).toBeUndefined();
    expect(createVideo).toHaveBeenCalledTimes(1);
    const args = createVideo.mock.calls[0];
    expect(args[0]).toBe("My clip");
    expect(args[1]).toBe("A description");
    expect(args[2]).toBeInstanceOf(ExternalBlob);
    expect(args[3]).toBeNull();
    expect(args.slice(4)).toEqual(["clip.mp4", "video/mp4", 100n, false, null]);
    expect(publishVideo).toHaveBeenCalledWith(1n);
  });

  it("forwards private visibility to the backend", async () => {
    const createVideo = vi.fn<Backend["createVideo"]>(async () => ({
      video: makeDraft(2n, "Private", true),
    }));
    const actor = {
      createVideo,
      publishVideo: vi.fn(async () => makePublished(2n, "Private", true)),
    } as unknown as Backend;

    await uploadService.uploadVideo(
      actor,
      makeFile(100),
      "Private",
      null,
      null,
      true,
      null,
    );

    expect(createVideo.mock.calls[0][7]).toBe(true);
  });

  it("uploads an optional thumbnail as a preview storage reference", async () => {
    const createVideo = vi.fn<Backend["createVideo"]>(async () => ({
      video: makeDraft(3n, "With preview"),
    }));
    const actor = {
      createVideo,
      publishVideo: vi.fn(async () => makePublished(3n, "With preview")),
    } as unknown as Backend;

    await uploadService.uploadVideo(
      actor,
      makeFile(100),
      "With preview",
      null,
      makeFile(50, "image/png", "preview.png"),
      false,
      null,
    );

    expect(createVideo.mock.calls[0][3]).toBeInstanceOf(ExternalBlob);
  });

  it("rejects a video that exceeds the maximum size before uploading", async () => {
    const actor = {
      createVideo: vi.fn(),
      publishVideo: vi.fn(),
    } as unknown as Backend;

    const oversized = makeFile(1_073_741_825);
    await expect(
      uploadService.uploadVideo(
        actor,
        oversized,
        "Too big",
        null,
        null,
        false,
        null,
      ),
    ).rejects.toThrow(/exceeds the maximum size/);

    expect(actor.createVideo).not.toHaveBeenCalled();
  });

  it("reports object-storage progress", async () => {
    const actor = {
      createVideo: vi.fn(async () => ({ video: makeDraft(1n, "My clip") })),
      publishVideo: vi.fn(async () => makePublished(1n, "My clip")),
    } as unknown as Backend;
    const onProgress = vi.fn();

    await uploadService.uploadVideo(
      actor,
      makeFile(100),
      "My clip",
      null,
      null,
      false,
      null,
      onProgress,
    );

    expect(onProgress).toHaveBeenLastCalledWith(100);
  });

  it("forwards a playlist selection and returns its id", async () => {
    const playlist = { __kind__: "existing" as const, existing: 9n };
    const createVideo = vi.fn<Backend["createVideo"]>(async () => ({
      video: makeDraft(4n, "Queued"),
      playlistId: 9n,
    }));
    const actor = {
      createVideo,
      publishVideo: vi.fn(async () => makePublished(4n, "Queued")),
    } as unknown as Backend;

    const result = await uploadService.uploadVideo(
      actor,
      makeFile(100),
      "Queued",
      null,
      null,
      false,
      playlist,
    );

    expect(createVideo.mock.calls[0][8]).toEqual(playlist);
    expect(result.playlistId).toBe(9n);
  });
});
