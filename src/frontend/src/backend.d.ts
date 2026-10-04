import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
import type { ExternalBlob } from "@caffeineai/object-storage";
export type { ExternalBlob } from "@caffeineai/object-storage";
export interface Cell {
    value: Value;
    name: string;
}
export interface CreateVideoResult {
    video: Video;
    playlistId?: bigint;
}
export type Cursor = bigint;
export type Error_ = {
    __kind__: "FrontendOriginsNotConfigured";
    FrontendOriginsNotConfigured: null;
} | {
    __kind__: "MixedSsoSources";
    MixedSsoSources: {
        otherKeys: Array<string>;
        ssoKeys: Array<string>;
    };
} | {
    __kind__: "Stale";
    Stale: {
        ageNs: bigint;
    };
} | {
    __kind__: "MalformedCandid";
    MalformedCandid: null;
} | {
    __kind__: "AmbiguousAttribute";
    AmbiguousAttribute: {
        field: string;
        sources: Array<string>;
    };
} | {
    __kind__: "NoAttributes";
    NoAttributes: null;
} | {
    __kind__: "UnknownNonce";
    UnknownNonce: null;
} | {
    __kind__: "UntrustedSsoSource";
    UntrustedSsoSource: {
        domain: string;
    };
} | {
    __kind__: "MissingField";
    MissingField: string;
} | {
    __kind__: "FrontendOriginMismatch";
    FrontendOriginMismatch: {
        got: string;
        expected: Array<string>;
    };
};
export interface Notification {
    id: bigint;
    kind: NotificationKind;
    createdAt: Timestamp;
    read: boolean;
    recipientId: UserId;
}
export type NotificationKind = {
    __kind__: "newVideo";
    newVideo: {
        channelId: UserId;
        videoId: bigint;
    };
} | {
    __kind__: "newSubscriber";
    newSubscriber: {
        channelId: UserId;
    };
};
export interface Page {
    items: Array<Video>;
    nextCursor?: Cursor;
}
export interface Page_1 {
    items: Array<Notification>;
    nextCursor?: Cursor;
}
export interface Page_2 {
    items: Array<PlaylistSummary>;
    nextCursor?: Cursor;
}
export interface Playlist {
    id: bigint;
    title: string;
    ownerId: UserId;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    isPrivate: boolean;
    videoIds: Array<bigint>;
}
export type PlaylistSelection = {
    __kind__: "new";
    new: {
        title: string;
        isPrivate: boolean;
    };
} | {
    __kind__: "existing";
    existing: bigint;
};
export interface PlaylistSummary {
    id: bigint;
    title: string;
    thumbnail?: ExternalBlob;
    videoCount: bigint;
    firstVideoId?: bigint;
    ownerId: UserId;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    isPrivate: boolean;
}
export interface PlaylistView {
    playlist: PlaylistSummary;
    videos: Array<Video>;
}
export interface Result {
    hasMore: boolean;
    rows: Array<Array<Cell>>;
}
export type Result__1 = {
    __kind__: "ok";
    ok: null;
} | {
    __kind__: "err";
    err: Error_;
};
export type Timestamp = bigint;
export interface User {
    id: UserId;
    bio?: string;
    username: string;
    displayName: string;
    createdAt: Timestamp;
    role?: Role;
    avatar?: ExternalBlob;
}
export type UserId = Principal;
export interface UserRoleView {
    id: UserId;
    username: string;
    displayName: string;
    role?: Role;
}
export type Value = {
    __kind__: "int";
    int: bigint;
} | {
    __kind__: "nat";
    nat: bigint;
} | {
    __kind__: "float";
    float: number;
} | {
    __kind__: "bool";
    bool: boolean;
} | {
    __kind__: "null";
    null: null;
} | {
    __kind__: "text";
    text: string;
};
export interface Video {
    id: bigint;
    status: VideoStatus;
    title: string;
    thumbnail?: ExternalBlob;
    ownerId: UserId;
    video: ExternalBlob;
    createdAt: Timestamp;
    publishedAt?: Timestamp;
    mimeType: string;
    description?: string;
    fileSize: bigint;
    filename: string;
    viewCount: bigint;
    isPrivate: boolean;
}
export enum Role {
    admin = "admin"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export enum VideoStatus {
    deleted = "deleted",
    published = "published",
    processing = "processing",
    draft = "draft"
}
export interface backendInterface {
    addVideoToPlaylist(playlistId: bigint, videoId: bigint): Promise<Playlist>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    bootstrapOwner(): Promise<void>;
    createPlaylist(title: string, isPrivate: boolean, initialVideoId: bigint | null): Promise<Playlist>;
    createVideo(title: string, description: string | null, video: ExternalBlob, thumbnail: ExternalBlob | null, filename: string, mimeType: string, fileSize: bigint, isPrivate: boolean, playlist: PlaylistSelection | null): Promise<CreateVideoResult>;
    deleteVideo(videoId: bigint): Promise<void>;
    execute(qJson: string): Promise<Result>;
    getApiDoc(): Promise<string>;
    getCallerProfile(): Promise<User | null>;
    getCallerUserRole(): Promise<UserRole>;
    getChannel(userId: UserId): Promise<User | null>;
    getChannelByUsername(username: string): Promise<User | null>;
    getChannelPlaylists(userId: UserId, cursor: Cursor, limit: bigint): Promise<Page_2>;
    getChannelVideos(userId: UserId, cursor: Cursor, limit: bigint): Promise<Page>;
    getFeed(cursor: Cursor, limit: bigint): Promise<Page>;
    getMyPlaylists(): Promise<Array<Playlist>>;
    getMyRole(): Promise<Role | null>;
    getMyVideos(cursor: Cursor, limit: bigint): Promise<Page>;
    getNotifications(cursor: Cursor, limit: bigint): Promise<Page_1>;
    getPlaylist(playlistId: bigint): Promise<PlaylistView | null>;
    getStorageProviders(): Promise<Array<string>>;
    getSubscribedChannels(): Promise<Array<UserId>>;
    getSubscriberCount(channelId: UserId): Promise<bigint>;
    getSubscriptionFeed(cursor: Cursor, limit: bigint): Promise<Page>;
    getUnreadNotificationCount(): Promise<bigint>;
    getVideo(videoId: bigint): Promise<Video | null>;
    grantAdminRole(target: UserId): Promise<UserRoleView>;
    isCallerAdmin(): Promise<boolean>;
    isSubscribed(channelId: UserId): Promise<boolean>;
    listUsersWithRoles(): Promise<Array<UserRoleView>>;
    markNotificationsRead(): Promise<void>;
    publishVideo(videoId: bigint): Promise<Video>;
    recordVideoView(videoId: bigint): Promise<bigint>;
    registerStorageProvider(providerId: string): Promise<void>;
    removeVideoFromPlaylist(playlistId: bigint, videoId: bigint): Promise<Playlist>;
    revokeAdminRole(target: UserId): Promise<UserRoleView>;
    saveProfile(displayName: string, username: string, avatar: ExternalBlob | null, removeAvatar: boolean, bio: string | null): Promise<User>;
    schema(): Promise<string>;
    subscribe(channelId: UserId): Promise<void>;
    unsubscribe(channelId: UserId): Promise<void>;
}
