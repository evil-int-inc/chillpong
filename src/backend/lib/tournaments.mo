import Array "mo:core/Array";
import Char "mo:core/Char";
import Int "mo:core/Int";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Runtime "mo:core/Runtime";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Common "../types/common";
import Tournaments "../types/tournaments";

module {
  public func normalizeInput(input : Tournaments.TournamentInput) : Tournaments.TournamentInput {
    let title = input.title.trim(#predicate(Char.isWhitespace));
    if (title.size() == 0 or title.size() > 100) {
      Runtime.trap("Tournament title must be between 1 and 100 characters");
    };
    let venue = input.venue.trim(#predicate(Char.isWhitespace));
    if (venue.size() == 0 or venue.size() > 150) {
      Runtime.trap("Tournament venue must be between 1 and 150 characters");
    };
    let description = input.description.trim(#predicate(Char.isWhitespace));
    if (description.size() > 2000) {
      Runtime.trap("Tournament description must be at most 2000 characters");
    };
    if (input.startsAt <= 0) {
      Runtime.trap("Tournament start time must be a positive timestamp");
    };
    if (input.capacity < 2) {
      Runtime.trap("Expected players must be at least 2");
    };
    { input with title; venue; description };
  };

  public func listTournaments(tournaments : Map.Map<Nat, Tournaments.Tournament>) : [Tournaments.Tournament] {
    tournaments.values().toArray().sort(func(a, b) {
      switch (Int.compare(a.startsAt, b.startsAt)) {
        case (#equal) { Nat.compare(a.id, b.id) };
        case order { order };
      };
    });
  };

  public func getTournament(tournaments : Map.Map<Nat, Tournaments.Tournament>, id : Nat) : ?Tournaments.Tournament {
    tournaments.get(id);
  };

  public func createTournament(
    tournaments : Map.Map<Nat, Tournaments.Tournament>,
    counters : Common.Counters,
    input : Tournaments.TournamentInput,
  ) : Tournaments.Tournament {
    let normalized = normalizeInput(input);
    let now = Time.now();
    let tournament : Tournaments.Tournament = {
      normalized with
      id = counters.nextTournamentId;
      createdAt = now;
      updatedAt = now;
    };
    counters.nextTournamentId += 1;
    tournaments.add(tournament.id, tournament);
    tournament;
  };

  public func updateTournament(
    tournaments : Map.Map<Nat, Tournaments.Tournament>,
    id : Nat,
    input : Tournaments.TournamentInput,
  ) : Tournaments.Tournament {
    let existing = tournaments.get(id) ?? Runtime.trap("Tournament not found");
    let normalized = normalizeInput(input);
    let updated : Tournaments.Tournament = {
      normalized with id; createdAt = existing.createdAt; updatedAt = Time.now()
    };
    tournaments.add(id, updated);
    updated;
  };

  public func formatToText(format : Tournaments.TournamentFormat) : Text {
    switch (format) { case (#singles) { "singles" }; case (#doubles) { "doubles" } };
  };

  public func statusToText(status : Tournaments.TournamentStatus) : Text {
    switch (status) {
      case (#upcoming) { "upcoming" };
      case (#live) { "live" };
      case (#completed) { "completed" };
    };
  };
};
