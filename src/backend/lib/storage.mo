import Text "mo:core/Text";
import Storage "../types/storage";

module {
  public func registerProvider(storage : Storage.StorageState, providerId : Text) : () {
    if (not storage.providers.contains(providerId)) {
      storage.providers := storage.providers.concat([providerId]);
    };
  };

  public func getProviders(storage : Storage.StorageState) : [Text] {
    storage.providers;
  };
};
