import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import AccessControl "mo:caffeineai-authorization/access-control";
import Common "../types/common";
import Players "../types/players";
import Users "../types/users";
import PlayersLib "../lib/players";
import RolesLib "../lib/roles";
import UsersLib "../lib/users";

mixin (
  accessControlState : AccessControl.AccessControlState,
  users : Map.Map<Common.UserId, Users.User>,
  usernames : Map.Map<Text, Common.UserId>,
  owner : Common.OwnerState,
  players : Map.Map<Nat, Players.GlobalPlayer>,
  counters : Common.Counters,
) {
  public query func listPlayers() : async [Players.GlobalPlayer] {
    PlayersLib.list(players);
  };

  public shared ({ caller }) func createPlayer(input : Players.PlayerInput) : async Players.GlobalPlayer {
    RolesLib.requireAdmin(accessControlState, caller);
    PlayersLib.create(players, counters, input, Time.now());
  };

  public shared ({ caller }) func updatePlayer(playerId : Nat, input : Players.PlayerInput) : async Players.GlobalPlayer {
    RolesLib.requireAdmin(accessControlState, caller);
    let updated = PlayersLib.update(players, playerId, input, Time.now());
    switch (updated.userId) {
      case (?userId) { ignore UsersLib.setLinkedPlayerName(users, usernames, userId, updated.name, RolesLib.effectiveRole(accessControlState, users, owner, userId)) };
      case null {};
    };
    updated;
  };

  public shared ({ caller }) func linkPlayerToUser(playerId : Nat, userId : Common.UserId) : async Players.GlobalPlayer {
    RolesLib.requireAdmin(accessControlState, caller);
    if (userId.isAnonymous() or accessControlState.userRoles.get(userId) == null) {
      Runtime.trap("Member must be an authenticated account");
    };
    let linked = PlayersLib.link(players, playerId, userId, Time.now());
    ignore UsersLib.setLinkedPlayerName(users, usernames, userId, linked.name, RolesLib.effectiveRole(accessControlState, users, owner, userId));
    linked;
  };

  public shared ({ caller }) func unlinkPlayerFromUser(playerId : Nat) : async Players.GlobalPlayer {
    RolesLib.requireAdmin(accessControlState, caller);
    PlayersLib.unlink(players, playerId, Time.now());
  };
};
