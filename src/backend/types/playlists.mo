import Common "../types/common";
import Videos "../types/videos";
import Storage "mo:caffeineai-object-storage/Storage";

module {
  public type Playlist = {
    id : Nat;
    ownerId : Common.UserId;
    title : Text;
    videoIds : [Nat];
    isPrivate : Bool;
    createdAt : Common.Timestamp;
    updatedAt : Common.Timestamp;
  };

  public type PlaylistSummary = {
    id : Nat;
    ownerId : Common.UserId;
    title : Text;
    videoCount : Nat;
    thumbnail : ?Storage.ExternalBlob;
    firstVideoId : ?Nat;
    isPrivate : Bool;
    createdAt : Common.Timestamp;
    updatedAt : Common.Timestamp;
  };

  public type PlaylistView = {
    playlist : PlaylistSummary;
    videos : [Videos.Video];
  };
};
