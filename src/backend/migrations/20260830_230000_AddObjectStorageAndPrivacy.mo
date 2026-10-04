import Array "mo:core/Array";
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
  };

  type User = {
    id : UserId;
    displayName : Text;
    username : Text;
    avatar : ?Text;
    bio : ?Text;
    createdAt : Timestamp;
  };

  type VideoStatus = { #draft; #processing; #published; #deleted };

  type OldVideo = {
    id : Nat;
    ownerId : UserId;
    title : Text;
    description : ?Text;
    videoAssetId : Text;
    thumbnailAssetId : ?Text;
    mimeType : Text;
    fileSize : Nat;
    createdAt : Timestamp;
    publishedAt : ?Timestamp;
    status : VideoStatus;
  };

  type NewVideo = {
    id : Nat;
    ownerId : UserId;
    title : Text;
    description : ?Text;
    video : Blob;
    thumbnail : ?Blob;
    filename : Text;
    mimeType : Text;
    fileSize : Nat;
    isPrivate : Bool;
    createdAt : Timestamp;
    publishedAt : ?Timestamp;
    status : VideoStatus;
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

  type StorageState = {
    var providers : [Text];
  };

  type OldActor = {
    accessControlState : AccessControl.AccessControlState;
    users : Map.Map<UserId, User>;
    usernames : Map.Map<Text, UserId>;
    videos : Map.Map<Nat, OldVideo>;
    uploadSessions : Map.Map<Nat, UploadSession>;
    counters : Counters;
    subscriptions : Map.Map<UserId, Set.Set<UserId>>;
    subscribers : Map.Map<UserId, Set.Set<UserId>>;
    notifications : Map.Map<UserId, List.List<Notification>>;
    storage : StorageState;
  };

  type NewActor = {
    accessControlState : AccessControl.AccessControlState;
    users : Map.Map<UserId, User>;
    usernames : Map.Map<Text, UserId>;
    videos : Map.Map<Nat, NewVideo>;
    uploadSessions : Map.Map<Nat, UploadSession>;
    counters : Counters;
    subscriptions : Map.Map<UserId, Set.Set<UserId>>;
    subscribers : Map.Map<UserId, Set.Set<UserId>>;
    notifications : Map.Map<UserId, List.List<Notification>>;
    storage : StorageState;
  };

  public func migration(old : OldActor) : NewActor {
    let videos = Map.empty<Nat, NewVideo>();
    for ((id, video) in old.videos.entries()) {
      // The previous uploader only counted bytes and never persisted them.
      // Hide those irrecoverable records instead of serving broken media.
      videos.add(id, {
        id = video.id;
        ownerId = video.ownerId;
        title = video.title;
        description = video.description;
        video = Array.toBlob([]);
        thumbnail = null;
        filename = "unavailable-legacy-video";
        mimeType = video.mimeType;
        fileSize = video.fileSize;
        isPrivate = false;
        createdAt = video.createdAt;
        publishedAt = video.publishedAt;
        status = #deleted;
      });
    };
    {
      accessControlState = old.accessControlState;
      users = old.users;
      usernames = old.usernames;
      videos;
      uploadSessions = old.uploadSessions;
      counters = old.counters;
      subscriptions = old.subscriptions;
      subscribers = old.subscribers;
      notifications = old.notifications;
      storage = old.storage;
    };
  };
};
