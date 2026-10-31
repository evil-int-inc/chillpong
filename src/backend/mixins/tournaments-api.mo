import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import AccessControl "mo:caffeineai-authorization/access-control";
import Common "../types/common";
import Tournaments "../types/tournaments";
import Players "../types/players";
import Users "../types/users";
import PlayersLib "../lib/players";
import TournamentsLib "../lib/tournaments";
import RolesLib "../lib/roles";
import Bracket "../lib/tournament-bracket";
import Organizer "../lib/tournament-organizer";

mixin (
  accessControlState : AccessControl.AccessControlState,
  tournaments : Map.Map<Nat, Tournaments.Tournament>,
  tournamentStates : Map.Map<Nat, Tournaments.TournamentStateData>,
  counters : Common.Counters,
  players : Map.Map<Nat, Players.GlobalPlayer>,
  users : Map.Map<Common.UserId, Users.User>,
) {
  func tournamentView(id : Nat, state : Tournaments.TournamentStateData) : Tournaments.TournamentState {
    let result = Bracket.view(id, state);
    { result with players = result.players.map(func player {
      let linked = switch (player.globalPlayerId) {
        case (?globalId) { players.get(globalId) };
        case null { null };
      };
      switch (linked) {
        case (?identity) {
          let account = PlayersLib.view(identity, users);
          { player with userId = account.userId; avatarUrl = account.avatarUrl };
        };
        case null { { player with globalPlayerId = null; userId = null; avatarUrl = null } };
      };
    }) };
  };

  public query func getTournaments() : async [Tournaments.Tournament] {
    TournamentsLib.listTournaments(tournaments);
  };

  public query func getTournament(id : Nat) : async ?Tournaments.Tournament {
    TournamentsLib.getTournament(tournaments, id);
  };

  public shared ({ caller }) func createTournament(input : Tournaments.TournamentInput) : async Tournaments.Tournament {
    RolesLib.requireAdmin(accessControlState, caller);
    let created = TournamentsLib.createTournament(tournaments, counters, input);
    tournamentStates.add(created.id, Bracket.initial(created.createdAt));
    created;
  };

  public shared ({ caller }) func updateTournament(id : Nat, input : Tournaments.TournamentInput) : async Tournaments.Tournament {
    RolesLib.requireAdmin(accessControlState, caller);
    // The editor explicitly sets the event status, independently of the draw.
    TournamentsLib.updateTournament(tournaments, id, input);
  };

  public shared ({ caller }) func deleteTournament(id : Nat) : async Tournaments.DeleteTournamentResult {
    if (caller.isAnonymous() or accessControlState.userRoles.get(caller) != ?#admin) {
      return #err(#notAuthorized);
    };
    if (tournaments.get(id) == null) { return #err(#notFound) };
    // Registrations, matches, results, and undo history belong to this state.
    // Shared player identities and member accounts belong to the club.
    tournamentStates.remove(id);
    tournaments.remove(id);
    #ok;
  };

  public query func getTournamentState(id : Nat) : async ?Tournaments.TournamentState {
    switch (tournaments.get(id)) {
      case (?tournament) { ?tournamentView(id, tournamentStates.get(id) ?? Bracket.initial(tournament.createdAt)) };
      case null { null };
    };
  };

  public shared ({ caller }) func applyTournamentCommand(id : Nat, command : Tournaments.TournamentCommand) : async Tournaments.TournamentState {
    RolesLib.requireAdmin(accessControlState, caller);
    let tournament = tournaments.get(id) ?? Runtime.trap("Tournament not found");
    let now = Time.now();
    let original = tournamentStates.get(id) ?? Bracket.initial(tournament.createdAt);
    // Register global identity separately from the tournament's permanent FIFO
    // ID. All validation and both writes occur in this single update message.
    let state = switch (command) {
      case (#addPlayer(input)) {
        let registered = Organizer.apply(original, command, now);
        let created = PlayersLib.create(players, counters, input, now);
        { registered with players = registered.players.map(func player = if (player.id == original.nextRegistrationNumber) { { player with globalPlayerId = ?created.id } } else { player }) };
      };
      case (#addExistingPlayer(input)) {
        let existing = PlayersLib.get(players, input.globalPlayerId);
        if (original.players.any(func player = player.globalPlayerId == ?existing.id)) { Runtime.trap("Player is already registered in this tournament") };
        let registered = Organizer.apply(original, #addPlayer({ name = existing.name; skillLevel = existing.skillLevel }), now);
        { registered with players = registered.players.map(func player = if (player.id == original.nextRegistrationNumber) { { player with globalPlayerId = ?existing.id } } else { player }) };
      };
      case _ { Organizer.apply(original, command, now) };
    };
    tournamentStates.add(id, state);
    // A completed event with an unfinished draw was closed manually. Keep it
    // closed during corrections. Automatic completion still follows the draw,
    // so undoing a finished final can reopen an automatically completed event.
    let manuallyCompleted = tournament.status == #completed and Bracket.champion(original) == null;
    let status : Tournaments.TournamentStatus = if (manuallyCompleted) { #completed } else if (not state.started) { #upcoming } else if (Bracket.champion(state) == null) { #live } else { #completed };
    tournaments.add(id, { tournament with status; updatedAt = now });
    tournamentView(id, state);
  };
};
