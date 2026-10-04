import Map "mo:core/Map";
import Set "mo:core/Set";
import List "mo:core/List";
import Principal "mo:core/Principal";
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

  type Video = {
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

  type OldActor = {};

  type NewActor = {
    accessControlState : AccessControl.AccessControlState;
    users : Map.Map<UserId, User>;
    usernames : Map.Map<Text, UserId>;
    videos : Map.Map<Nat, Video>;
    uploadSessions : Map.Map<Nat, UploadSession>;
    counters : Counters;
    subscriptions : Map.Map<UserId, Set.Set<UserId>>;
    subscribers : Map.Map<UserId, Set.Set<UserId>>;
    notifications : Map.Map<UserId, List.List<Notification>>;
    storage : StorageState;
  };

  public func migration(_old : OldActor) : NewActor {
    {
      accessControlState = AccessControl.initState();
      users = Map.empty();
      usernames = Map.empty();
      videos = Map.empty();
      uploadSessions = Map.empty();
      counters = { var nextVideoId = 0; var nextUploadSessionId = 0; var nextNotificationId = 0 };
      subscriptions = Map.empty();
      subscribers = Map.empty();
      notifications = Map.empty();
      storage = { var providers = [] };
    };
  };
};
