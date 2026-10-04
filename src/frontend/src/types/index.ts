import {
  type Notification as BackendNotification,
  type NotificationKind as BackendNotificationKind,
  type Page_1 as BackendNotificationPage,
  type Page as BackendPage,
  type Playlist as BackendPlaylist,
  type Page_2 as BackendPlaylistPage,
  type PlaylistSelection as BackendPlaylistSelection,
  type PlaylistSummary as BackendPlaylistSummary,
  type PlaylistView as BackendPlaylistView,
  type User as BackendUser,
  type UserRoleView as BackendUserRoleView,
  type Video as BackendVideo,
  Role,
  UserRole,
  VideoStatus,
} from "@/backend";
import type { Principal } from "@icp-sdk/core/principal";

/** Re-exported backend enums for convenience. */
export { Role, UserRole, VideoStatus };

export type UserId = Principal;
export type Timestamp = bigint;
export type Cursor = bigint;

export interface User extends BackendUser {}
export interface Video extends BackendVideo {}
export interface Notification extends BackendNotification {}
export type NotificationKind = BackendNotificationKind;
export interface Playlist extends BackendPlaylist {}
export interface PlaylistSummary extends BackendPlaylistSummary {}
export interface PlaylistView extends BackendPlaylistView {}
export type PlaylistSelection = BackendPlaylistSelection;

/** A user row with their current role, as returned by the admin API. */
export interface UserRoleView extends BackendUserRoleView {}

/** Cursor-paginated page of videos. */
export interface Page<T> {
  items: T[];
  nextCursor?: Cursor;
}

/** Cursor-paginated page of notifications. */
export interface NotificationPage {
  items: Notification[];
  nextCursor?: Cursor;
}

/** Cursor-paginated page of channel playlist summaries. */
export interface PlaylistPage {
  items: PlaylistSummary[];
  nextCursor?: Cursor;
}

/** Maps a backend video page to the generic Page<T> shape. */
export function toPage(page: BackendPage): Page<Video> {
  return { items: page.items, nextCursor: page.nextCursor };
}

/** Maps a backend notification page to the generic NotificationPage shape. */
export function toNotificationPage(
  page: BackendNotificationPage,
): NotificationPage {
  return { items: page.items, nextCursor: page.nextCursor };
}

/** Maps a backend playlist page to the frontend Page shape. */
export function toPlaylistPage(page: BackendPlaylistPage): PlaylistPage {
  return { items: page.items, nextCursor: page.nextCursor };
}
