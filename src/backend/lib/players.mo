import Char "mo:core/Char";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Runtime "mo:core/Runtime";
import Text "mo:core/Text";
import Common "../types/common";
import Players "../types/players";
import Users "../types/users";

module {
  public func view(player : Players.GlobalPlayer, users : Map.Map<Common.UserId, Users.User>) : Players.GlobalPlayerView {
    let avatarUrl = switch (player.userId) {
      case (?userId) { switch (users.get(userId)) { case (?user) { user.avatarUrl }; case null { null } } };
      case null { null };
    };
    { player with avatarUrl };
  };

  public func normalizeInput(input : Players.PlayerInput) : Players.PlayerInput {
    let name = input.name.trim(#predicate(Char.isWhitespace));
    if (name.size() == 0 or name.size() > 80) { Runtime.trap("Player name must be between 1 and 80 characters") };
    if (input.skillLevel < 1 or input.skillLevel > 5) { Runtime.trap("Skill level must be between 1 and 5") };
    { input with name };
  };

  public func get(players : Map.Map<Nat, Players.GlobalPlayer>, id : Nat) : Players.GlobalPlayer {
    players.get(id) ?? Runtime.trap("Player not found");
  };

  public func list(players : Map.Map<Nat, Players.GlobalPlayer>) : [Players.GlobalPlayer] {
    players.values().toArray().sort(func(a, b) = Nat.compare(a.id, b.id));
  };

  public func create(players : Map.Map<Nat, Players.GlobalPlayer>, counters : Common.Counters, input : Players.PlayerInput, now : Int) : Players.GlobalPlayer {
    let normalized = normalizeInput(input);
    let player : Players.GlobalPlayer = {
      normalized with id = counters.nextPlayerId; userId = null; createdAt = now; updatedAt = now;
    };
    counters.nextPlayerId += 1;
    players.add(player.id, player);
    player;
  };

  public func update(players : Map.Map<Nat, Players.GlobalPlayer>, id : Nat, input : Players.PlayerInput, now : Int) : Players.GlobalPlayer {
    let existing = get(players, id);
    let normalized = normalizeInput(input);
    let updated = { existing with name = normalized.name; skillLevel = normalized.skillLevel; updatedAt = now };
    players.add(id, updated);
    updated;
  };

  public func link(players : Map.Map<Nat, Players.GlobalPlayer>, id : Nat, userId : Common.UserId, now : Int) : Players.GlobalPlayer {
    let existing = get(players, id);
    if (existing.userId != null and existing.userId != ?userId) { Runtime.trap("Player is already linked to another member; unlink it first") };
    if (players.values().any(func player = player.id != id and player.userId == ?userId)) {
      Runtime.trap("Member is already linked to another player; unlink it first");
    };
    let linked = { existing with userId = ?userId; updatedAt = now };
    players.add(id, linked);
    linked;
  };

  public func unlink(players : Map.Map<Nat, Players.GlobalPlayer>, id : Nat, now : Int) : Players.GlobalPlayer {
    let existing = get(players, id);
    let unlinked = { existing with userId = null; updatedAt = now };
    players.add(id, unlinked);
    unlinked;
  };
};
