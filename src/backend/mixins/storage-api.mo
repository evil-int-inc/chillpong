import Runtime "mo:core/Runtime";
import AccessControl "mo:caffeineai-authorization/access-control";
import Storage "../types/storage";
import StorageLib "../lib/storage";

mixin (
  accessControlState : AccessControl.AccessControlState,
  storage : Storage.StorageState,
) {
  public query ({ caller }) func getStorageProviders() : async [Text] {
    ignore caller;
    StorageLib.getProviders(storage);
  };

  public shared ({ caller }) func registerStorageProvider(providerId : Text) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin)) {
      Runtime.trap("Unauthorized: Only admins can perform this action");
    };
    StorageLib.registerProvider(storage, providerId);
  };
};
