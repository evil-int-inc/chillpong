import Array "mo:core/Array";
import Char "mo:core/Char";
import Int "mo:core/Int";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Common "../types/common";
import Users "../types/users";

module {
  public func canonicalUsername(username : Text) : Text {
    username.trim(#predicate(Char.isWhitespace)).toLower();
  };

  func normalizeInputWithExistingUsername(input : Users.UserInput, existingUsername : ?Text) : Users.UserInput {
    let displayName = input.displayName.trim(#predicate(Char.isWhitespace));
    if (displayName.size() > 80) {
      Runtime.trap("Display name must be at most 80 characters");
    };
    let unchangedLegacyUsername = switch (existingUsername) {
      case (?existing) { input.username.trim(#predicate(Char.isWhitespace)) == existing.trim(#predicate(Char.isWhitespace)) };
      case null { false };
    };
    let username = if (unchangedLegacyUsername) {
      existingUsername ?? input.username;
    } else {
      let normalized = canonicalUsername(input.username);
      if (normalized.size() != 0 and (normalized.size() < 3 or normalized.size() > 30)) {
        Runtime.trap("Username must be between 3 and 30 characters");
      };
      for (character in normalized.toIter()) {
        if (not ((character >= 'a' and character <= 'z') or (character >= '0' and character <= '9') or character == '_' or character == '-')) {
          Runtime.trap("Username may only contain letters, numbers, underscores, and hyphens");
        };
      };
      normalized;
    };
    let bio = switch (input.bio) {
      case (?value) {
        let normalized = value.trim(#predicate(Char.isWhitespace));
        if (normalized.size() > 500) {
          Runtime.trap("Bio must be at most 500 characters");
        };
        if (normalized.size() == 0) { null } else { ?normalized };
      };
      case null { null };
    };
    { displayName; username; bio };
  };

  public func normalizeInput(input : Users.UserInput) : Users.UserInput {
    normalizeInputWithExistingUsername(input, null);
  };

  func assertUsernameAvailable(users : Map.Map<Common.UserId, Users.User>, username : Text, excludedUser : ?Common.UserId) : () {
    let canonical = canonicalUsername(username);
    if (canonical == "") { return };
    for (user in users.values()) {
      if (?user.id != excludedUser and canonicalUsername(user.username) == canonical) {
        Runtime.trap("Username already taken");
      };
    };
  };

  public func createUser(
    users : Map.Map<Common.UserId, Users.User>,
    usernames : Map.Map<Text, Common.UserId>,
    id : Common.UserId,
    input : Users.UserInput,
    role : ?Users.Role,
  ) : Users.User {
    if (id.isAnonymous()) {
      Runtime.trap("Anonymous principals cannot be users");
    };
    if (users.get(id) != null) {
      Runtime.trap("User already exists");
    };
    let normalized = normalizeInput(input);
    assertUsernameAvailable(users, normalized.username, null);
    let user : Users.User = {
      id;
      displayName = normalized.displayName;
      username = normalized.username;
      avatar = null;
      bio = normalized.bio;
      createdAt = Time.now();
      role;
    };
    users.add(id, user);
    if (user.username != "") { usernames.add(user.username, id) };
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
    let exact = username.trim(#predicate(Char.isWhitespace));
    if (exact == "") { return null };
    switch (usernames.get(exact)) {
      case (?id) {
        switch (users.get(id)) {
          case (?user) { return ?user };
          case null {};
        };
      };
      case null {};
    };
    let canonical = canonicalUsername(username);
    for (user in users.values()) {
      if (canonicalUsername(user.username) == canonical) {
        return ?user;
      };
    };
    null;
  };

  public func updateUser(
    users : Map.Map<Common.UserId, Users.User>,
    usernames : Map.Map<Text, Common.UserId>,
    id : Common.UserId,
    input : Users.UserInput,
  ) : Users.User {
    let existing = users.get(id) ?? Runtime.trap("User not found");
    let normalized = normalizeInputWithExistingUsername(input, ?existing.username);
    if (existing.username != normalized.username) {
      assertUsernameAvailable(users, normalized.username, ?id);
      if (existing.username != "") { usernames.remove(existing.username) };
      if (normalized.username != "") { usernames.add(normalized.username, id) };
    };
    let updated = {
      existing with
      displayName = normalized.displayName;
      username = normalized.username;
      bio = normalized.bio;
    };
    users.add(id, updated);
    updated;
  };

  public func listUsers(users : Map.Map<Common.UserId, Users.User>) : [Users.User] {
    users.values().toArray().sort(func(a, b) = Int.compare(b.createdAt, a.createdAt));
  };

  public func setRole(
    users : Map.Map<Common.UserId, Users.User>,
    id : Common.UserId,
    role : ?Users.Role,
  ) : ?Users.User {
    switch (users.get(id)) {
      case (?existing) {
        let updated = { existing with role };
        users.add(id, updated);
        ?updated;
      };
      case null { null };
    };
  };

  public func listUserRoles(users : Map.Map<Common.UserId, Users.User>) : [Users.UserRoleView] {
    listUsers(users).map(func u = {
      id = u.id; displayName = u.displayName; username = u.username; role = u.role
    });
  };
};
