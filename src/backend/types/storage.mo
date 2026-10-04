import Common "../types/common";

module {
  public type StorageKind = {
    #video;
    #thumbnail;
  };

  // Storage abstraction for future multi-storage-canister support.
  // `providers` holds registered storage canister ids; empty means a single
  // default storage provider is used.
  public type StorageState = {
    var providers : [Text];
  };

  public type StorageRef = {
    assetId : Text;
    kind : StorageKind;
    size : Nat;
  };
};
