import Common "../types/common";
import Storage "mo:caffeineai-object-storage/Storage";

module {
  // App-level role. `null` on the User record means a regular user;
  // `?{ #admin }` means the user is an app admin. There are no other tiers.
  public type Role = { #admin };

  public type User = {
    id : Common.UserId;
    displayName : Text;
    username : Text; // unique
    avatar : ?Storage.ExternalBlob;
    bio : ?Text;
    createdAt : Common.Timestamp;
    role : ?Role;
  };

  public type UserInput = {
    displayName : Text;
    username : Text;
    bio : ?Text;
  };

  // Admin-facing view of a user, including the current role.
  public type UserRoleView = {
    id : Common.UserId;
    displayName : Text;
    username : Text;
    role : ?Role;
  };
};
