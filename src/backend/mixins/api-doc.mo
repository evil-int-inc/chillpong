mixin () {
  public query func getApiDoc() : async Text {
    "# ChillPong Backend API

ChillPong is a YouTube-like video platform on the Internet Computer, with
immutable object storage for large media. This document describes the public Candid API of the backend canister:
its purpose, authentication and authorization model, identity derivation, units
and encodings, lifecycle and polling rules, mutation retry safety, and the
non-obvious integration gotchas.

## Purpose

The backend stores users (channel profiles), immutable video references,
playlists, subscriptions, and per-user notifications. It exposes:

- Public channel profiles and a global, published-only video feed with backend
  cursor pagination.
- Immutable object-storage uploads for videos (up to 1 GB) and optional
  thumbnails (up to 20 MB in the frontend).
- Subscribe/unsubscribe and a subscription feed of published videos.
- Ordered public/private playlists with caller-aware video filtering.
- Per-user notifications for new subscribers and new videos from subscribed
  channels.
- An app-level role system (regular user or admin) with admin-only role
  management and an owner bootstrap.
- An OQL data layer (`schema` / `execute`) that makes the persisted data
  queryable by the Caffeine Data Intelligence agent and, per entity, by end
  users.

## Public methods

### Authentication & authorization

- `_internet_identity_sign_in_start() : async Blob`
- `_internet_identity_sign_in_finish() : async Result.Result<(), Error>`
- `_initialize_access_control() : async ()`
- `getCallerUserRole() : async UserRole`
- `assignCallerUserRole(user : Principal, role : UserRole) : async ()`
- `isCallerAdmin() : async Bool`

### Roles & admin

- `getMyRole() : async ?Role` — the caller's app-level role (`?{ #admin }` or
  `null`).
- `listUsersWithRoles() : async [UserRoleView]` — admin-only; every user with
  their current role.
- `grantAdminRole(target : Principal) : async UserRoleView` — admin-only; grants
  the admin role to `target`.
- `revokeAdminRole(target : Principal) : async UserRoleView` — admin-only;
  revokes the admin role from `target`.
- `bootstrapOwner() : async ()` — records the caller as the owner on first call
  and applies the owner admin role; idempotent.

### Users / profiles

- `getChannel(userId : Principal) : async ?User`
- `getChannelByUsername(username : Text) : async ?User`
- `getCallerProfile() : async ?User`
- `saveProfile(displayName : Text, username : Text, avatar : ?ExternalBlob, removeAvatar : Bool, bio : ?Text) : async User`

### Video & storage

- `createVideo(title : Text, description : ?Text, video : ExternalBlob, thumbnail : ?ExternalBlob, filename : Text, mimeType : Text, fileSize : Nat, isPrivate : Bool, playlist : ?PlaylistSelection) : async CreateVideoResult`
- `publishVideo(videoId : Nat) : async Video`
- `deleteVideo(videoId : Nat) : async ()`
- `getVideo(videoId : Nat) : async ?Video`
- `recordVideoView(videoId : Nat) : async Nat`
- `getMyVideos(cursor : Nat, limit : Nat) : async Page<Video>`
- `getStorageProviders() : async [Text]`
- `registerStorageProvider(providerId : Text) : async ()`

### Playlists

- `createPlaylist(title : Text, isPrivate : Bool, initialVideoId : ?Nat) : async Playlist`
- `addVideoToPlaylist(playlistId : Nat, videoId : Nat) : async Playlist`
- `removeVideoFromPlaylist(playlistId : Nat, videoId : Nat) : async Playlist`
- `getMyPlaylists() : async [Playlist]`
- `getChannelPlaylists(userId : Principal, cursor : Nat, limit : Nat) : async Page<PlaylistSummary>`
- `getPlaylist(playlistId : Nat) : async ?PlaylistView`

### Subscriptions

- `subscribe(channelId : Principal) : async ()`
- `unsubscribe(channelId : Principal) : async ()`
- `isSubscribed(channelId : Principal) : async Bool`
- `getSubscribedChannels() : async [Principal]`
- `getSubscriberCount(channelId : Principal) : async Nat`

### Notifications

- `getNotifications(cursor : Nat, limit : Nat) : async Page<Notification>`
- `getUnreadNotificationCount() : async Nat`
- `markNotificationsRead() : async ()`

### Feed

- `getFeed(cursor : Nat, limit : Nat) : async Page<Video>`
- `getSubscriptionFeed(cursor : Nat, limit : Nat) : async Page<Video>`
- `getChannelVideos(userId : Principal, cursor : Nat, limit : Nat) : async Page<Video>`

### OQL data layer

- `schema() : async Text` — JSON schema of the queryable entities.
- `execute(qJson : Text) : async Result` — run a JSON query against the entities.

## Authentication and authorization

### Registration prerequisite

Access is gated by role-based access control. Before any role-guarded call
(guarded queries included), a signed-in caller must register by calling
`_initialize_access_control()` once. The **first** caller to register becomes
`#admin`; every subsequent caller becomes `#user`. Anonymous callers are
skipped and never registered. `_internet_identity_sign_in_finish()` also
registers the caller as part of the sign-in flow.

Roles are `#admin`, `#user`, and `#guest` (anonymous). A caller with `#admin`
passes every permission check; `#user` passes checks that require `#user`;
`#guest` (anonymous) fails checks that require `#user` or `#admin`.

### App-level roles

Independently of the authorization package's `UserRole`, each user profile
carries an app-level `role` that is either `null` (regular user) or
`?{ #admin }`. `getMyRole()` returns this app-level role. `grantAdminRole` and
`revokeAdminRole` keep the app-level role and the authorization package's role
in sync (`#admin` / `#user`). There are no other role tiers.

### Owner bootstrap

The backend has no init arguments and no platform-provided owner principal, so
the owner is captured as the first principal to call `bootstrapOwner()` (the
frontend calls it once after sign-in). The first caller to register with the
authorization package is already `#admin`; `bootstrapOwner()` records that
principal as the owner and mirrors the admin role onto the app-level
`User.role`. `bootstrapOwner()` is idempotent and safe to call on every
sign-in: it re-applies the owner's admin role, so the owner keeps admin access
after the app goes live and is upgraded. `revokeAdminRole` refuses to revoke
the owner's admin role.

### What an unregistered or anonymous caller receives

- **Anonymous caller** on a guarded endpoint that traps: the call traps with
  `Unauthorized: Only users can perform this action` (or
  `Unauthorized: Only admins can perform this action` for
  `registerStorageProvider`, `listUsersWithRoles`, `grantAdminRole`, and
  `revokeAdminRole`).
- **Anonymous caller** on a guarded endpoint that returns early instead of
  trapping: `getCallerProfile` returns `null`, `getMyRole` returns `null`,
  `isSubscribed` returns `false`, `getSubscribedChannels` returns `[]`,
  `getUnreadNotificationCount` returns `0`, and `getSubscriptionFeed` returns
  an empty page.
- **Unregistered signed-in (non-anonymous) caller**: the permission check
  itself traps with `User is not registered`, because the role lookup cannot
  find the caller. This applies to every guarded endpoint, including the ones
  that return early for anonymous callers.

### Why a caller can be unregistered

Registration happens only when a caller signs in through the app's own
frontend (or calls `_initialize_access_control` directly). A principal that
never did so is unregistered even when it belongs to the app's owner. A
signed-in caller derived against a different origin is a different principal
than the one the frontend registered, and therefore appears unregistered.

### Identity derivation

The frontend pins an Internet Identity derivation origin, published at
`/.well-known/ii-derivation-origin` when available. An agent already holding
the user's Internet Identity authorization derives the correct per-app
principal against that origin, for example:

    icp identity link web <name> --app <host>

Such a delegation acts with the user's full authority in this app until it
expires.

## Units and encodings

- **Timestamps** are nanoseconds since the Unix epoch (`Time.now()`), typed as
  `Int`. `createdAt` and `publishedAt` use this encoding.
- **`UserId`** is a `Principal` (the caller's principal).
- **`Cursor`** is a `Nat`. `0` means \"first page\"; otherwise it is the id of
  the last item already returned (see Lifecycle and polling).
- **`Page<T>`** is `{ items : [T]; nextCursor : ?Nat }`.
- **`VideoStatus`**: `#draft`, `#processing`, `#published`, `#deleted`.
- **`PlaylistSelection`**: `#existing Nat` or `#new { title; isPrivate }`.
- **`NotificationKind`**: `#newSubscriber { channelId }` or
  `#newVideo { channelId; videoId }`.
- **`UserRole`** (authorization package): `#admin`, `#user`, `#guest`.
- **`Role`** (app-level): `{ #admin }`. A user's app-level role is `?Role`;
  `null` means a regular user.
- **`UserRoleView`** is `{ id : Principal; displayName : Text; username : Text;
  role : ?Role }`.
- **Optional fields**: `bio` and `description` are `?Text`; `avatar` and
  `thumbnail` are `?ExternalBlob`; `publishedAt` is `?Int`. `null` means absent.
- **`video` / `thumbnail` / `avatar`** are immutable object-storage references. Generated
  frontend bindings expose them as `ExternalBlob`; use `getDirectURL()` for
  browser playback or image display.

## Lifecycle and polling

### Upload pipeline

The frontend creates `ExternalBlob` values from the selected files. Generated
bindings upload their bytes to the storage gateway in one-megabyte chunks,
then call `createVideo` with immutable references and metadata. `createVideo`
validates the declared video metadata and creates a `#draft` record.
`publishVideo(videoId)` sets the record to `#published` and records
`publishedAt`. Subscribers are notified only for public videos.

Global and subscription feeds return only public `#published` videos.
Channel pages also return only public videos, except that the channel owner
can see their own private published videos. `getVideo` returns a private video
only to its owner, so privacy is enforced before media references reach the
frontend.

`recordVideoView(videoId)` increments the durable view counter after playback
starts. It accepts published public videos and private videos viewed by their
owner, and returns the updated count.

### Playlist lifecycle and privacy

`createVideo` can atomically add the new draft to an owned playlist or create a
playlist containing it. The returned `playlistId` lets the frontend preserve
playlist context after publication. A rejected playlist validation rolls back
the whole create call. Like any non-idempotent create, do not blindly retry an
uncertain response: a committed retry can create another video and playlist.

Playlist order follows `videoIds`; duplicate additions are no-ops. Owners can
save any published video they can view. Private playlists are returned only to
their owners. Playlist summaries and views filter deleted, draft, and
inaccessible private videos before calculating counts, selecting thumbnails,
or returning media references. Non-owners do not receive empty playlists on a
channel page.

### Pagination

All paginated endpoints (`getFeed`, `getSubscriptionFeed`, `getChannelVideos`,
`getChannelPlaylists`, `getMyVideos`, `getNotifications`) return newest-first by descending id. Pass
`cursor = 0` for the first page, then pass the returned `nextCursor` as the
next `cursor`. Stop polling when `nextCursor` is `null`. A `limit` of `0`
returns an empty page with `nextCursor = null`.

## Mutation retry safety

- Storage-gateway chunk retries are managed by the object-storage client before
  the canister mutation is sent.
- **`subscribe` / `unsubscribe`** are idempotent: subscribing twice to the same
  channel is a no-op (a set add), and unsubscribing from a channel you do not
  follow is a no-op. `subscribe` traps `Cannot subscribe to yourself` when
  `channelId == caller`.
- **`publishVideo` / `deleteVideo`** are idempotent status transitions: they
  overwrite the video's status. `publishVideo` re-notifies subscribers on every
  call, so call it once.
- **`markNotificationsRead`** is idempotent.
- **`saveProfile`** upserts the caller's profile. It traps `Username already
  taken` if the requested `username` is held by another user. Supplying an
  avatar replaces it; otherwise `removeAvatar = true` removes the current one
  and `false` preserves it.
- **`recordVideoView` is not idempotent.** Call it only for the first playback
  event in a watch-page visit.
- **`addVideoToPlaylist` / `removeVideoFromPlaylist` are idempotent.** Adding an
  existing member or removing a missing member returns the unchanged playlist.
- **`createVideo` / `createPlaylist` are not idempotent.** Retry only a known
  rejection; an uncertain response may already have committed.
- **`grantAdminRole` / `revokeAdminRole`** are idempotent: granting an existing
  admin or revoking a non-admin leaves the role unchanged. `bootstrapOwner` is
  idempotent and safe to call on every sign-in.

## Errors, traps, and limits

- **Traps** (opaque rejects, not `Result` errors): `Unauthorized: Only users
  can perform this action`, `Unauthorized: Only admins can perform this
  action`, `Unauthorized: Not the video owner`, `User is not registered`,
  `Cannot subscribe to yourself`, `Username already taken`, `Video not found`,
  `Video not available`, `Playlist not found`, `Playlist limit reached`,
  `Playlist video limit reached`, `User not found` (role management on a
  principal with no profile), `Cannot revoke the owner's admin role`,
  and validation messages for invalid title, filename, MIME type, description,
  or file size.
- **Size limits**: videos are limited to 1 GB by both the frontend and
  `createVideo`; thumbnails are limited to 20 MB and avatars to 5 MB by the
  frontend.
- **Ownership**: `publishVideo` and `deleteVideo` require the caller to own the
  video. Playlist mutations require the caller to own the playlist. Private
  reads expose records only to their owners.

## Non-obvious integration gotchas

- A caller must register (via `_initialize_access_control` or the frontend
  sign-in) before any guarded call; an unregistered signed-in caller traps with
  `User is not registered` rather than receiving a graceful denial.
- `deleteVideo` is a soft delete: the video row remains in storage with status
  `#deleted`, is removed from playlist membership, and is excluded from feeds
  and `getVideo` for non-owners.
- `getVideo` returns `null` for a private or non-published video unless the
  caller is its owner.
- `getMyRole` is safe for anonymous callers (returns `null`) and does not trap
  for unregistered callers; the admin-only role endpoints do trap.
- The owner is captured on the first `bootstrapOwner()` call, so the frontend
  must call it once after the owner signs in. Until then `getMyRole` reports
  `null` for the owner.
- OQL `schema()` and `execute()` honour per-entity authorization: public
  users are readable by anyone, while videos, playlists, upload sessions,
  subscriptions, and notifications are scoped so each signed-in caller reads
  only owned rows.
- The `user` OQL entity exposes the persisted app-level role as a `role` text
  column: `\"admin\"` for an admin and `\"user\"` for a regular user. It also
  exposes `bio` (empty string when absent). Because the `user` entity is
  public, these columns are readable by anyone who can query the canister.
"
  };
};
