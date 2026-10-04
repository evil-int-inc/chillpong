import { type Actor, PocketIc, createIdentity } from "@dfinity/pic";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";
import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";

const PIC_URL = process.env.POCKET_IC_URL ?? "";
const BACKEND_WASM = process.env.BACKEND_WASM ?? "";

// Two distinct signed-in principals. The first caller to register via
// `_initialize_access_control` becomes admin; every subsequent caller becomes
// user. Admin passes every permission check, so alice drives the upload flow
// while bob (a plain user) exercises subscriptions and caller isolation.
const alice = createIdentity("alice").getPrincipal();
const bob = createIdentity("bob").getPrincipal();

let pic: PocketIc | undefined;
let actor: Actor<_SERVICE>;

// Creates an immutable storage reference and publishes the video as `owner`.
async function publishVideo(
  owner: typeof alice,
  title: string,
  size: number,
  isPrivate = false,
  thumbnail: [] | [Uint8Array] = [],
) {
  actor.setPrincipal(owner);
  const draft = await actor.createVideo(
    title,
    [],
    new Uint8Array([1, 2, 3]),
    thumbnail,
    "clip.mp4",
    "video/mp4",
    BigInt(size),
    isPrivate,
    [],
  );
  return actor.publishVideo(draft.video.id);
}

beforeAll(async () => {
  pic = await PocketIc.create(PIC_URL);
  ({ actor } = await pic.setupCanister<_SERVICE>({
    idlFactory,
    wasm: BACKEND_WASM,
  }));

  // Register both callers so role-guarded methods do not trap with
  // "User is not registered". alice (first) becomes admin, bob becomes user.
  actor.setPrincipal(alice);
  await actor._initialize_access_control();
  actor.setPrincipal(bob);
  await actor._initialize_access_control();
});

afterAll(async () => {
  // `?.` because `beforeAll` may not have got that far. A failed
  // `PocketIc.create` otherwise stacks "Cannot read properties of undefined"
  // on top of the real error and buries the one line that explains the run.
  await pic?.tearDown();
});

describe("YourChain backend", () => {
  it("answers an empty feed read instead of trapping", async () => {
    actor.setPrincipal(alice);
    const page = await actor.getFeed(0n, 10n);
    expect(page.items).toEqual([]);
    expect(page.nextCursor).toEqual([]);
  });

  it("stores uploaded avatars and can explicitly remove them", async () => {
    actor.setPrincipal(alice);
    const created = await actor.saveProfile(
      "Alice",
      "alice",
      [new Uint8Array([9, 8, 7])],
      false,
      ["Creator"],
    );
    expect(created.avatar).toEqual([new Uint8Array([9, 8, 7])]);

    const retained = await actor.saveProfile("Alice", "alice", [], false, [
      "Updated",
    ]);
    expect(retained.avatar).toEqual([new Uint8Array([9, 8, 7])]);

    const removed = await actor.saveProfile("Alice", "alice", [], true, [
      "Updated",
    ]);
    expect(removed.avatar).toEqual([]);
  });

  it("creates a stored video reference and surfaces the public video in feeds", async () => {
    actor.setPrincipal(alice);

    const draft = await actor.createVideo(
      "My clip",
      ["A description"],
      new Uint8Array([4, 5, 6]),
      [],
      "clip.mp4",
      "video/mp4",
      100n,
      false,
      [],
    );
    expect(draft.playlistId).toEqual([]);
    expect(draft.video.status).toEqual({ draft: null });
    expect(draft.video.title).toBe("My clip");
    expect(draft.video.ownerId).toEqual(alice);
    expect(draft.video.filename).toBe("clip.mp4");
    expect(draft.video.viewCount).toBe(0n);
    expect(draft.video.isPrivate).toBe(false);

    const published = await actor.publishVideo(draft.video.id);
    expect(published.status).toEqual({ published: null });
    // publishVideo records a publishedAt timestamp.
    expect(published.publishedAt.length).toBe(1);

    // Only published videos appear in the global feed.
    const feed = await actor.getFeed(0n, 10n);
    expect(feed.items).toContainEqual(
      expect.objectContaining({
        id: draft.video.id,
        title: "My clip",
        status: { published: null },
      }),
    );

    // The channel page lists the owner's published videos.
    const channel = await actor.getChannelVideos(alice, 0n, 10n);
    expect(channel.items).toContainEqual(
      expect.objectContaining({ id: draft.video.id, ownerId: alice }),
    );

    expect(await actor.recordVideoView(draft.video.id)).toBe(1n);
    expect((await actor.getVideo(draft.video.id))[0]?.viewCount).toBe(1n);
  });

  it("associates a new upload with a newly created playlist atomically", async () => {
    actor.setPrincipal(alice);
    const draft = await actor.createVideo(
      "Playlist upload",
      [],
      new Uint8Array([7, 8, 9]),
      [new Uint8Array([42])],
      "playlist-clip.mp4",
      "video/mp4",
      75n,
      false,
      [{ new: { title: "Upload queue", isPrivate: false } }],
    );

    expect(draft.playlistId).toHaveLength(1);
    const playlistId = draft.playlistId[0];
    expect(playlistId).toBeDefined();

    const storedPlaylist = (await actor.getMyPlaylists()).find(
      (playlist) => playlist.id === playlistId,
    );
    expect(storedPlaylist).toEqual(
      expect.objectContaining({
        id: playlistId,
        title: "Upload queue",
        videoIds: [draft.video.id],
      }),
    );

    // Playlist reads never expose a draft, even to its owner.
    const draftView = (await actor.getPlaylist(playlistId!))[0];
    expect(draftView?.videos).toEqual([]);
    expect(draftView?.playlist.videoCount).toBe(0n);

    await actor.publishVideo(draft.video.id);
    const secondDraft = await actor.createVideo(
      "Second playlist upload",
      [],
      new Uint8Array([10, 11, 12]),
      [],
      "second-playlist-clip.mp4",
      "video/mp4",
      76n,
      false,
      [{ existing: playlistId! }],
    );
    expect(secondDraft.playlistId).toEqual([playlistId]);

    const playlistWithDraft = (await actor.getMyPlaylists()).find(
      (item) => item.id === playlistId,
    );
    expect(playlistWithDraft?.videoIds).toEqual([
      draft.video.id,
      secondDraft.video.id,
    ]);
    expect(
      (await actor.getPlaylist(playlistId!))[0]?.videos.map(
        (video) => video.id,
      ),
    ).toEqual([draft.video.id]);

    await actor.publishVideo(secondDraft.video.id);
    const view = (await actor.getPlaylist(playlistId!))[0];
    expect(view?.videos.map((video) => video.id)).toEqual([
      draft.video.id,
      secondDraft.video.id,
    ]);
  });

  it("keeps playlist order, mutations, privacy, and summaries caller-safe", async () => {
    const privateVideo = await publishVideo(alice, "Private opener", 30, true, [
      new Uint8Array([10]),
    ]);
    const firstPublicVideo = await publishVideo(
      alice,
      "First public",
      31,
      false,
      [new Uint8Array([20])],
    );
    const secondPublicVideo = await publishVideo(
      alice,
      "Second public",
      32,
      false,
      [new Uint8Array([30])],
    );

    actor.setPrincipal(alice);
    const playlist = await actor.createPlaylist("Ordered mix", false, [
      privateVideo.id,
    ]);
    await actor.addVideoToPlaylist(playlist.id, firstPublicVideo.id);
    const afterSecond = await actor.addVideoToPlaylist(
      playlist.id,
      secondPublicVideo.id,
    );
    expect(afterSecond.videoIds).toEqual([
      privateVideo.id,
      firstPublicVideo.id,
      secondPublicVideo.id,
    ]);

    // Adding the same video is deliberately idempotent and does not alter order.
    const afterDuplicate = await actor.addVideoToPlaylist(
      playlist.id,
      firstPublicVideo.id,
    );
    expect(afterDuplicate.videoIds).toEqual(afterSecond.videoIds);

    const ownerView = (await actor.getPlaylist(playlist.id))[0];
    expect(ownerView?.videos.map((video) => video.id)).toEqual(
      afterSecond.videoIds,
    );
    expect(ownerView?.playlist).toEqual(
      expect.objectContaining({
        videoCount: 3n,
        firstVideoId: [privateVideo.id],
        thumbnail: [new Uint8Array([10])],
      }),
    );

    const privatePlaylist = await actor.createPlaylist("Owner only", true, [
      firstPublicVideo.id,
    ]);
    const mine = await actor.getMyPlaylists();
    expect(mine.map(({ id }) => id)).toEqual(
      expect.arrayContaining([playlist.id, privatePlaylist.id]),
    );

    actor.setPrincipal(bob);
    await expect(
      actor.addVideoToPlaylist(playlist.id, firstPublicVideo.id),
    ).rejects.toThrow(/Playlist not found/);
    await expect(
      actor.removeVideoFromPlaylist(playlist.id, firstPublicVideo.id),
    ).rejects.toThrow(/Playlist not found/);

    // A public playlist remains readable, but inaccessible videos are removed
    // server-side while preserving the relative order of visible entries.
    const publicView = (await actor.getPlaylist(playlist.id))[0];
    expect(publicView?.videos.map((video) => video.id)).toEqual([
      firstPublicVideo.id,
      secondPublicVideo.id,
    ]);
    expect(publicView?.playlist).toEqual(
      expect.objectContaining({
        videoCount: 2n,
        firstVideoId: [firstPublicVideo.id],
        thumbnail: [new Uint8Array([20])],
      }),
    );

    const publicChannelPlaylists = await actor.getChannelPlaylists(
      alice,
      0n,
      100n,
    );
    expect(publicChannelPlaylists.items).toContainEqual(
      expect.objectContaining({
        id: playlist.id,
        videoCount: 2n,
        firstVideoId: [firstPublicVideo.id],
        thumbnail: [new Uint8Array([20])],
      }),
    );
    expect(
      publicChannelPlaylists.items.some(({ id }) => id === privatePlaylist.id),
    ).toBe(false);
    expect(await actor.getPlaylist(privatePlaylist.id)).toEqual([]);

    actor.setPrincipal(alice);
    const ownerChannelPlaylists = await actor.getChannelPlaylists(
      alice,
      0n,
      100n,
    );
    expect(ownerChannelPlaylists.items).toContainEqual(
      expect.objectContaining({ id: privatePlaylist.id, videoCount: 1n }),
    );

    await actor.deleteVideo(secondPublicVideo.id);
    const afterDelete = (await actor.getMyPlaylists()).find(
      ({ id }) => id === playlist.id,
    );
    expect(afterDelete?.videoIds).toEqual([
      privateVideo.id,
      firstPublicVideo.id,
    ]);
  });

  it("normalizes playlist names and rejects whitespace-only titles", async () => {
    actor.setPrincipal(alice);
    await expect(actor.createPlaylist(" \n\t ", false, [])).rejects.toThrow(
      /Playlist title must be between 1 and 100 characters/,
    );

    const playlist = await actor.createPlaylist("  Clean title  ", false, []);
    expect(playlist.title).toBe("Clean title");
  });

  it("supports subscribe/unsubscribe and rejects self-subscription", async () => {
    // Seed alice with a published video so the subscription feed has content.
    const aliceVideo = await publishVideo(alice, "Alice's clip", 64);

    actor.setPrincipal(bob);
    await actor.subscribe(alice);
    expect(await actor.isSubscribed(alice)).toBe(true);
    expect(await actor.getSubscribedChannels()).toContainEqual(alice);

    // A subscriber's feed includes the channel's published video.
    const subFeed = await actor.getSubscriptionFeed(0n, 10n);
    expect(subFeed.items).toContainEqual(
      expect.objectContaining({ id: aliceVideo.id, ownerId: alice }),
    );

    await actor.unsubscribe(alice);
    expect(await actor.isSubscribed(alice)).toBe(false);
    expect(await actor.getSubscribedChannels()).not.toContainEqual(alice);

    // A user cannot subscribe to themselves.
    await expect(actor.subscribe(bob)).rejects.toThrow(
      /Cannot subscribe to yourself/,
    );
  });

  it("keeps private videos out of every public read and exposes them to the owner", async () => {
    actor.setPrincipal(bob);
    await actor.subscribe(alice);

    const privateVideo = await publishVideo(alice, "Alice private", 50, true);

    // Even the owner does not receive private videos through the global feed.
    const ownerFeed = await actor.getFeed(0n, 100n);
    expect(ownerFeed.items.some((video) => video.id === privateVideo.id)).toBe(
      false,
    );

    actor.setPrincipal(bob);
    const feed = await actor.getFeed(0n, 100n);
    const subscriptionFeed = await actor.getSubscriptionFeed(0n, 100n);
    const channel = await actor.getChannelVideos(alice, 0n, 100n);
    expect(feed.items.some((video) => video.id === privateVideo.id)).toBe(
      false,
    );
    expect(
      subscriptionFeed.items.some((video) => video.id === privateVideo.id),
    ).toBe(false);
    expect(channel.items.some((video) => video.id === privateVideo.id)).toBe(
      false,
    );
    expect(await actor.getVideo(privateVideo.id)).toEqual([]);
    await expect(actor.recordVideoView(privateVideo.id)).rejects.toThrow(
      /Video not available/,
    );

    const notifications = await actor.getNotifications(0n, 100n);
    expect(
      notifications.items.some(
        (notification) =>
          "newVideo" in notification.kind &&
          notification.kind.newVideo.videoId === privateVideo.id,
      ),
    ).toBe(false);

    actor.setPrincipal(alice);
    expect((await actor.getVideo(privateVideo.id))[0]?.id).toBe(
      privateVideo.id,
    );
    expect(await actor.recordVideoView(privateVideo.id)).toBe(1n);
    const ownerChannel = await actor.getChannelVideos(alice, 0n, 100n);
    expect(ownerChannel.items).toContainEqual(
      expect.objectContaining({ id: privateVideo.id, isPrivate: true }),
    );

    actor.setPrincipal(bob);
    await actor.unsubscribe(alice);
  });
});
