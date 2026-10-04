import List "mo:core/List";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Set "mo:core/Set";
import AccessControl "mo:caffeineai-authorization/access-control";

module {
  type UserId = Principal;
  type Timestamp = Int;

  type Counters = {
    var nextVideoId : Nat;
    var nextUploadSessionId : Nat;
    var nextNotificationId : Nat;
    var nextPlaylistId : Nat;
  };

  type Role = { #admin };

  type OldUser = {
    id : UserId;
    displayName : Text;
    username : Text;
    avatar : ?Blob;
    bio : ?Text;
    createdAt : Timestamp;
  };

  type NewUser = {
    id : UserId;
    displayName : Text;
    username : Text;
    avatar : ?Blob;
    bio : ?Text;
    createdAt : Timestamp;
    role : ?Role;
  };

  type VideoStatus = { #draft; #processing; #published; #deleted };

  type Video = {
    id : Nat;
    ownerId : UserId;
    title : Text;
    description : ?Text;
    video : Blob;
    thumbnail : ?Blob;
    filename : Text;
    mimeType : Text;
    fileSize : Nat;
    viewCount : Nat;
    isPrivate : Bool;
    createdAt : Timestamp;
    publishedAt : ?Timestamp;
    status : VideoStatus;
  };

  type Playlist = {
    id : Nat;
    ownerId : UserId;
    title : Text;
    videoIds : [Nat];
    isPrivate : Bool;
    createdAt : Timestamp;
    updatedAt : Timestamp;
  };

  type UploadKind = { #video; #thumbnail };
  type UploadStatus = { #active; #completed; #finalized; #cancelled };

  type UploadSession = {
    id : Nat;
    ownerId : UserId;
    kind : UploadKind;
    assetId : Text;
    mimeType : Text;
    totalSize : Nat;
    chunkSize : Nat;
    receivedBytes : Nat;
    status : UploadStatus;
    createdAt : Timestamp;
  };

  type NotificationKind = {
    #newSubscriber : { channelId : UserId };
    #newVideo : { channelId : UserId; videoId : Nat };
  };

  type Notification = {
    id : Nat;
    recipientId : UserId;
    kind : NotificationKind;
    createdAt : Timestamp;
    read : Bool;
  };

  type StorageState = { var providers : [Text] };

  type OwnerState = {
    var ownerPrincipal : ?Principal;
    var ownerApplied : Bool;
  };

  type OldActor = {
    accessControlState : AccessControl.AccessControlState;
    users : Map.Map<UserId, OldUser>;
    usernames : Map.Map<Text, UserId>;
    videos : Map.Map<Nat, Video>;
    playlists : Map.Map<Nat, Playlist>;
    uploadSessions : Map.Map<Nat, UploadSession>;
    counters : Counters;
    subscriptions : Map.Map<UserId, Set.Set<UserId>>;
    subscribers : Map.Map<UserId, Set.Set<UserId>>;
    notifications : Map.Map<UserId, List.List<Notification>>;
    storage : StorageState;
  };

  type NewActor = {
    accessControlState : AccessControl.AccessControlState;
    users : Map.Map<UserId, NewUser>;
    usernames : Map.Map<Text, UserId>;
    videos : Map.Map<Nat, Video>;
    playlists : Map.Map<Nat, Playlist>;
    uploadSessions : Map.Map<Nat, UploadSession>;
    counters : Counters;
    subscriptions : Map.Map<UserId, Set.Set<UserId>>;
    subscribers : Map.Map<UserId, Set.Set<UserId>>;
    notifications : Map.Map<UserId, List.List<Notification>>;
    storage : StorageState;
    owner : OwnerState;
  };

  public func migration(old : OldActor) : NewActor {
    {
      accessControlState = old.accessControlState;
      users = old.users.map(
        func(_, user) { { user with role = null } }
      );
      usernames = old.usernames;
      videos = old.videos;
      playlists = old.playlists;
      uploadSessions = old.uploadSessions;
      counters = old.counters;
      subscriptions = old.subscriptions;
      subscribers = old.subscribers;
      notifications = old.notifications;
      storage = old.storage;
      owner = { var ownerPrincipal = null; var ownerApplied = false };
    };
  };
};
