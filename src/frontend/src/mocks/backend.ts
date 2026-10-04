import type { backendInterface } from "../backend";
import { Role, UserRole, VideoStatus } from "../backend";
import { Principal } from "@icp-sdk/core/principal";

const SELF = Principal.fromText("aaaaa-aa");
const ALICE = Principal.fromText("2vxsx-fae");
const BOB = Principal.fromText("rrkah-fqaaa-aaaaa-aaaaq-cai");

const now = BigInt(Date.now()) * BigInt(1_000_000);

const users = [
  {
    id: SELF,
    username: "owner",
    displayName: "Owner Account",
    role: Role.admin,
  },
  {
    id: ALICE,
    username: "alice",
    displayName: "Alice Rivera",
    role: undefined,
  },
  {
    id: BOB,
    username: "bob",
    displayName: "Bob Chen",
    role: Role.admin,
  },
];

export const mockBackend: backendInterface = {
  _immutableObjectStorageBlobsAreLive: async () => [],
  _immutableObjectStorageBlobsToDelete: async () => [],
  _immutableObjectStorageConfirmBlobDeletion: async () => undefined,
  _immutableObjectStorageCreateCertificate: async () => ({
    method: "PUT",
    blob_hash: "",
  }),
  _immutableObjectStorageRefillCashier: async () => ({}),
  _immutableObjectStorageUpdateGatewayPrincipals: async () => undefined,
  _initialize_access_control: async () => undefined,
  _internet_identity_sign_in_finish: async () => ({ __kind__: "ok", ok: null }),
  _internet_identity_sign_in_start: async () => new Uint8Array(),

  addVideoToPlaylist: async (playlistId) => ({
    id: playlistId,
    title: "Sample playlist",
    ownerId: SELF,
    createdAt: now,
    updatedAt: now,
    isPrivate: false,
    videoIds: [],
  }),
  assignCallerUserRole: async () => undefined,
  bootstrapOwner: async () => undefined,
  createPlaylist: async (title, isPrivate) => ({
    id: BigInt(1),
    title,
    ownerId: SELF,
    createdAt: now,
    updatedAt: now,
    isPrivate,
    videoIds: [],
  }),
  createVideo: async (title, description, video, thumbnail, filename, mimeType, fileSize, isPrivate) => ({
    video: {
      id: BigInt(1),
      status: VideoStatus.draft,
      title,
      thumbnail: thumbnail ?? undefined,
      ownerId: SELF,
      video,
      createdAt: now,
      publishedAt: undefined,
      mimeType,
      description: description ?? undefined,
      fileSize,
      filename,
      viewCount: BigInt(0),
      isPrivate,
    },
  }),
  deleteVideo: async () => undefined,
  execute: async () => ({ hasMore: false, rows: [] }),
  getApiDoc: async () => "# ChillPong API",
  getCallerProfile: async () => ({
    id: SELF,
    username: "owner",
    displayName: "Owner Account",
    createdAt: now,
    role: Role.admin,
    bio: "Founder of ChillPong",
    avatar: undefined,
  }),
  getCallerUserRole: async () => UserRole.admin,
  getChannel: async (userId) => ({
    id: userId,
    username: "owner",
    displayName: "Owner Account",
    createdAt: now,
    role: Role.admin,
    bio: undefined,
    avatar: undefined,
  }),
  getChannelByUsername: async () => null,
  getChannelPlaylists: async () => ({ items: [], nextCursor: undefined }),
  getChannelVideos: async () => ({ items: [], nextCursor: undefined }),
  getFeed: async () => ({ items: [], nextCursor: undefined }),
  getMyPlaylists: async () => [],
  getMyRole: async () => Role.admin,
  getMyVideos: async () => ({ items: [], nextCursor: undefined }),
  getNotifications: async () => ({ items: [], nextCursor: undefined }),
  getPlaylist: async () => null,
  getStorageProviders: async () => [],
  getSubscribedChannels: async () => [],
  getSubscriberCount: async () => BigInt(0),
  getSubscriptionFeed: async () => ({ items: [], nextCursor: undefined }),
  getUnreadNotificationCount: async () => BigInt(0),
  getVideo: async () => null,
  grantAdminRole: async (target) => {
    const user = users.find((u) => u.id.toString() === target.toString());
    return {
      id: target,
      username: user?.username ?? "user",
      displayName: user?.displayName ?? "User",
      role: Role.admin,
    };
  },
  isCallerAdmin: async () => true,
  isSubscribed: async () => false,
  listUsersWithRoles: async () =>
    users.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      role: u.role,
    })),
  markNotificationsRead: async () => undefined,
  publishVideo: async (videoId) => ({
    id: videoId,
    status: VideoStatus.published,
    title: "Sample video",
    thumbnail: undefined,
    ownerId: SELF,
    video: { getDirectURL: () => "" } as never,
    createdAt: now,
    publishedAt: now,
    mimeType: "video/mp4",
    description: undefined,
    fileSize: BigInt(0),
    filename: "sample.mp4",
    viewCount: BigInt(0),
    isPrivate: false,
  }),
  recordVideoView: async () => BigInt(1),
  registerStorageProvider: async () => undefined,
  removeVideoFromPlaylist: async (playlistId) => ({
    id: playlistId,
    title: "Sample playlist",
    ownerId: SELF,
    createdAt: now,
    updatedAt: now,
    isPrivate: false,
    videoIds: [],
  }),
  revokeAdminRole: async (target) => {
    const user = users.find((u) => u.id.toString() === target.toString());
    return {
      id: target,
      username: user?.username ?? "user",
      displayName: user?.displayName ?? "User",
      role: undefined,
    };
  },
  saveProfile: async (displayName, username) => ({
    id: SELF,
    username,
    displayName,
    createdAt: now,
    role: Role.admin,
    bio: undefined,
    avatar: undefined,
  }),
  schema: async () => "{}",
  subscribe: async () => undefined,
  unsubscribe: async () => undefined,
};
