import Map "mo:core/Map";
import AccessControl "mo:caffeineai-authorization/access-control";
import Common "../types/common";
import Tournaments "../types/tournaments";
import TournamentsLib "../lib/tournaments";
import RolesLib "../lib/roles";

mixin (
  accessControlState : AccessControl.AccessControlState,
  tournaments : Map.Map<Nat, Tournaments.Tournament>,
  counters : Common.Counters,
) {
  public query func getTournaments() : async [Tournaments.Tournament] {
    TournamentsLib.listTournaments(tournaments);
  };

  public query func getTournament(id : Nat) : async ?Tournaments.Tournament {
    TournamentsLib.getTournament(tournaments, id);
  };

  public shared ({ caller }) func createTournament(input : Tournaments.TournamentInput) : async Tournaments.Tournament {
    RolesLib.requireAdmin(accessControlState, caller);
    TournamentsLib.createTournament(tournaments, counters, input);
  };

  public shared ({ caller }) func updateTournament(id : Nat, input : Tournaments.TournamentInput) : async Tournaments.Tournament {
    RolesLib.requireAdmin(accessControlState, caller);
    TournamentsLib.updateTournament(tournaments, id, input);
  };
};
