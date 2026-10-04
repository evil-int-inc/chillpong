import Common "../types/common";
import Storage "mo:caffeineai-object-storage/Storage";

module {
  public type VideoStatus = {
    #draft;
    #processing;
    #published;
    #deleted;
  };

  public type Video = {
    id : Nat;
    ownerId : Common.UserId;
    title : Text;
    description : ?Text;
    video : Storage.ExternalBlob;
    thumbnail : ?Storage.ExternalBlob;
    filename : Text;
    mimeType : Text;
    fileSize : Nat;
    viewCount : Nat;
    isPrivate : Bool;
    createdAt : Common.Timestamp;
    publishedAt : ?Common.Timestamp;
    status : VideoStatus;
  };

  public type PlaylistSelection = {
    #existing : Nat;
    #new : { title : Text; isPrivate : Bool };
  };

  public type CreateVideoResult = {
    video : Video;
    playlistId : ?Nat;
  };

  public type UploadKind = {
    #video;
    #thumbnail;
  };

  public type UploadStatus = {
    #active;
    #completed;
    #finalized;
    #cancelled;
  };

  public type UploadSession = {
    id : Nat;
    ownerId : Common.UserId;
    kind : UploadKind;
    assetId : Text;
    mimeType : Text;
    totalSize : Nat;
    chunkSize : Nat;
    receivedBytes : Nat;
    status : UploadStatus;
    createdAt : Common.Timestamp;
  };
};
