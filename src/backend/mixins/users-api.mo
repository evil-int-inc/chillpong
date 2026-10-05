import Array "mo:core/Array";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import AccessControl "mo:caffeineai-authorization/access-control";
import Common "../types/common";
import Users "../types/users";
import UsersLib "../lib/users";
import RolesLib "../lib/roles";

mixin (
  accessControlState : AccessControl.AccessControlState,
  users : Map.Map<Common.UserId, Users.User>,
  usernames : Map.Map<Text, Common.UserId>,
  owner : Common.OwnerState,
) {
  func toUserView(user : Users.User) : Users.User {
    { user with role = RolesLib.effectiveRole(accessControlState, users, owner, user.id) };
  };

  func optionalUserView(user : ?Users.User) : ?Users.User {
    switch (user) { case (?value) { ?toUserView(value) }; case null { null } };
  };

  public query func listUsers() : async [Users.User] {
    UsersLib.listUsers(users).map(toUserView);
  };

  public query func getUser(userId : Common.UserId) : async ?Users.User {
    optionalUserView(UsersLib.getUser(users, userId));
  };

  public query func getUserByUsername(username : Text) : async ?Users.User {
    optionalUserView(UsersLib.getByUsername(usernames, users, username));
  };

  public query ({ caller }) func getCallerProfile() : async ?Users.User {
    if (caller.isAnonymous()) { return null };
    optionalUserView(UsersLib.getUser(users, caller));
  };

  // The caller supplies no target principal or role: members can edit only
  // their own optional name/username, preserving all other profile fields.
  public shared ({ caller }) func saveCallerProfile(input : Users.ProfileInput) : async Users.User {
    if (caller.isAnonymous() or accessControlState.userRoles.get(caller) == null) {
      Runtime.trap("Unauthorized: Sign in to edit your profile");
    };
    let existing = users.get(caller);
    let role = RolesLib.effectiveRole(accessControlState, users, owner, caller);
    let userInput : Users.UserInput = {
      displayName = input.displayName;
      username = input.username;
      bio = switch (existing) { case (?user) { user.bio }; case null { null } };
    };
    let saved = switch (existing) {
      case (?_) { UsersLib.updateUser(users, usernames, caller, userInput) };
      case null { UsersLib.createUser(users, usernames, caller, userInput, role) };
    };
    toUserView(UsersLib.setRole(users, caller, role) ?? saved);
  };

  public shared ({ caller }) func createUser(userId : Common.UserId, input : Users.UserInput) : async Users.User {
    RolesLib.requireAdmin(accessControlState, caller);
    let role = RolesLib.effectiveRole(accessControlState, users, owner, userId);
    toUserView(UsersLib.createUser(users, usernames, userId, input, role));
  };

  public shared ({ caller }) func updateUser(userId : Common.UserId, input : Users.UserInput) : async Users.User {
    RolesLib.requireAdmin(accessControlState, caller);
    let updated = UsersLib.updateUser(users, usernames, userId, input);
    let role = RolesLib.effectiveRole(accessControlState, users, owner, userId);
    toUserView(UsersLib.setRole(users, userId, role) ?? updated);
  };
};
