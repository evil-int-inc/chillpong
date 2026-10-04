import Runtime "mo:core/Runtime";
import Int "mo:core/Int";
import Map "mo:core/Map";
import Common "../types/common";
import Users "../types/users";
import Storage "mo:caffeineai-object-storage/Storage";

module {
  public func createUser(
    users : Map.Map<Common.UserId, Users.User>,
    usernames : Map.Map<Text, Common.UserId>,
    id : Common.UserId,
    displayName : Text,
    username : Text,
    avatar : ?Storage.ExternalBlob,
    bio : ?Text,
    now : Common.Timestamp,
  ) : Users.User {
    let user : Users.User = {
      id;
      displayName;
      username;
      avatar;
      bio;
      createdAt = now;
      role = null;
    };
    users.add(id, user);
    usernames.add(username, id);
    user;
  };

  public func getUser(users : Map.Map<Common.UserId, Users.User>, id : Common.UserId) : ?Users.User {
    users.get(id);
  };

  public func getByUsername(
    usernames : Map.Map<Text, Common.UserId>,
    users : Map.Map<Common.UserId, Users.User>,
    username : Text,
  ) : ?Users.User {
    switch (usernames.get(username)) {
      case (?id) { users.get(id) };
      case null { null };
    };
  };

  public func updateProfile(
    users : Map.Map<Common.UserId, Users.User>,
    usernames : Map.Map<Text, Common.UserId>,
    id : Common.UserId,
    displayName : Text,
    username : Text,
    avatar : ?Storage.ExternalBlob,
    bio : ?Text,
  ) : Users.User {
    let existing = users.get(id) ?? Runtime.trap("User not found");
    if (existing.username != username) {
      usernames.remove(existing.username);
      usernames.add(username, id);
    };
    let updated : Users.User = {
      id = existing.id;
      displayName;
      username;
      avatar;
      bio;
      createdAt = existing.createdAt;
      role = existing.role;
    };
    users.add(id, updated);
    updated;
  };

  public func isUsernameTaken(usernames : Map.Map<Text, Common.UserId>, username : Text) : Bool {
    usernames.get(username) != null;
  };

  // Sets the app-level role on an existing user record. Returns the updated
  // user, or null when no user record exists for `id`.
  public func setRole(
    users : Map.Map<Common.UserId, Users.User>,
    id : Common.UserId,
    role : ?Users.Role,
  ) : ?Users.User {
    switch (users.get(id)) {
      case (?existing) {
        let updated : Users.User = {
          id = existing.id;
          displayName = existing.displayName;
          username = existing.username;
          avatar = existing.avatar;
          bio = existing.bio;
          createdAt = existing.createdAt;
          role;
        };
        users.add(id, updated);
        ?updated;
      };
      case null { null };
    };
  };

  // Lists every user with their current role, newest first by createdAt.
  public func listUserRoles(users : Map.Map<Common.UserId, Users.User>) : [Users.UserRoleView] {
    let all = users.values().toArray();
    let sorted = all.sort(func(a, b) = Int.compare(b.createdAt, a.createdAt));
    sorted.map(func(u) : Users.UserRoleView {
      { id = u.id; displayName = u.displayName; username = u.username; role = u.role };
    });
  };
};
