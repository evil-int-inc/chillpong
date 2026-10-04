import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import Map "mo:core/Map";
import AccessControl "mo:caffeineai-authorization/access-control";
import ObjectStorage "mo:caffeineai-object-storage/Storage";
import Common "../types/common";
import Users "../types/users";
import UsersLib "../lib/users";

mixin (
  accessControlState : AccessControl.AccessControlState,
  users : Map.Map<Common.UserId, Users.User>,
  usernames : Map.Map<Text, Common.UserId>,
) {
  public query ({ caller }) func getChannel(userId : Common.UserId) : async ?Users.User {
    ignore caller;
    UsersLib.getUser(users, userId);
  };

  public query ({ caller }) func getChannelByUsername(username : Text) : async ?Users.User {
    ignore caller;
    UsersLib.getByUsername(usernames, users, username);
  };

  public query ({ caller }) func getCallerProfile() : async ?Users.User {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      return null;
    };
    UsersLib.getUser(users, caller);
  };

  public shared ({ caller }) func saveProfile(
    displayName : Text,
    username : Text,
    avatar : ?ObjectStorage.ExternalBlob,
    removeAvatar : Bool,
    bio : ?Text,
  ) : async Users.User {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can perform this action");
    };
    switch (UsersLib.getUser(users, caller)) {
      case (?existing) {
        if (existing.username != username and UsersLib.isUsernameTaken(usernames, username)) {
          Runtime.trap("Username already taken");
        };
        let nextAvatar = switch (avatar) {
          case (?uploaded) { ?uploaded };
          case null {
            if (removeAvatar) { null } else { existing.avatar };
          };
        };
        UsersLib.updateProfile(users, usernames, caller, displayName, username, nextAvatar, bio);
      };
      case null {
        if (UsersLib.isUsernameTaken(usernames, username)) {
          Runtime.trap("Username already taken");
        };
        let nextAvatar = if (removeAvatar) { null } else { avatar };
        UsersLib.createUser(users, usernames, caller, displayName, username, nextAvatar, bio, Time.now());
      };
    };
  };
};
