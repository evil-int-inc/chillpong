import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import AccessControl "mo:caffeineai-authorization/access-control";
import Common "../types/common";
import Tournaments "../types/tournaments";
import Players "../types/players";
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
) {
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
    let state = tournamentStates.get(id);
    let status = switch (state) {
      case (?engine) { if (engine.started) { if (Bracket.champion(engine) == null) { #live } else { #completed } } else { input.status } };
      case null { input.status };
    };
    TournamentsLib.updateTournament(tournaments, id, { input with status });
  };

  public query func getTournamentState(id : Nat) : async ?Tournaments.TournamentState {
    switch (tournaments.get(id)) {
      case (?tournament) { ?Bracket.view(id, tournamentStates.get(id) ?? Bracket.initial(tournament.createdAt)) };
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
    let status : Tournaments.TournamentStatus = if (not state.started) { #upcoming } else if (Bracket.champion(state) == null) { #live } else { #completed };
    tournaments.add(id, { tournament with status; updatedAt = now });
    Bracket.view(id, state);
  };
};
