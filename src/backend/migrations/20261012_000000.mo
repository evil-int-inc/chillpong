import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";
import AccessControl "mo:caffeineai-authorization/access-control";

module {
  // Frozen migration records: later app-type edits must not change an upgrade.
  type UserId = Principal;
  type Timestamp = Int;
  type Counters = { var nextTournamentId : Nat; var nextPlayerId : Nat };
  type OwnerState = { var ownerPrincipal : ?Principal; var ownerApplied : Bool };
  type Role = { #admin };
  type User = { id : UserId; displayName : Text; username : Text; avatar : ?Blob; bio : ?Text; createdAt : Timestamp; role : ?Role };
  type GlobalPlayer = { id : Nat; name : Text; skillLevel : Nat; userId : ?UserId; createdAt : Timestamp; updatedAt : Timestamp };
  type TelegramConfigState = { var clientId : ?Text };
  type TelegramLink = { subject : Text; username : Text; linkedAt : Int };
  type TelegramChallenge = { nonce : Text; clientId : Text; createdAt : Int; expiresAt : Int };
  type TelegramCachedKeys = { body : Text; expiresAt : Int };
  type TelegramCacheState = { var keys : ?TelegramCachedKeys };
  type TournamentFormat = { #singles; #doubles };
  type TournamentStatus = { #upcoming; #live; #completed };
  type TournamentElimination = { #singleElimination; #doubleElimination };
  type TournamentBracket = { #winners; #losers; #grandFinal; #resetFinal };
  type MatchSource = { #player : Nat; #winner : Nat; #loser : Nat; #bye };
  type TournamentMatchStatus = { #blocked; #ready; #playing; #completed; #bye; #cancelled };
  type Tournament = { id : Nat; title : Text; description : Text; venue : Text; startsAt : Timestamp; format : TournamentFormat; capacity : Nat; status : TournamentStatus; createdAt : Timestamp; updatedAt : Timestamp };
  type TournamentPlayerData = { id : Nat; globalPlayerId : ?Nat; name : Text; skillLevel : Nat; registrationNumber : Nat; registeredAt : Timestamp; removed : Bool; queuePriority : Int };
  type TournamentMatch = { id : Nat; bracket : TournamentBracket; round : Nat; position : Nat; sourceA : MatchSource; sourceB : MatchSource; playerA : ?Nat; playerB : ?Nat; scoreA : ?Nat; scoreB : ?Nat; winnerId : ?Nat; loserId : ?Nat; status : TournamentMatchStatus; table : ?Nat; priority : Int; manualOverride : Bool };
  type TournamentAction = { id : Nat; caption : Text; createdAt : Timestamp };
  type TournamentSnapshot = { elimination : TournamentElimination; tableCount : Nat; started : Bool; players : [TournamentPlayerData]; matches : [TournamentMatch] };
  type TournamentHistoryEntry = { action : TournamentAction; snapshot : TournamentSnapshot };
  type TournamentStateData = { elimination : TournamentElimination; tableCount : Nat; started : Bool; players : [TournamentPlayerData]; matches : [TournamentMatch]; history : [TournamentHistoryEntry]; nextRegistrationNumber : Nat; nextMatchId : Nat; nextActionId : Nat; updatedAt : Timestamp };

  type OldCounters = { var nextTournamentId : Nat };
  type OldPlayer = {
    id : Nat;
    name : Text;
    skillLevel : Nat;
    registrationNumber : Nat;
    registeredAt : Int;
    removed : Bool;
    queuePriority : Int;
  };
  type OldSnapshot = {
    elimination : TournamentElimination;
    tableCount : Nat;
    started : Bool;
    players : [OldPlayer];
    matches : [TournamentMatch];
  };
  type OldHistory = { action : TournamentAction; snapshot : OldSnapshot };
  type OldState = {
    elimination : TournamentElimination;
    tableCount : Nat;
    started : Bool;
    players : [OldPlayer];
    matches : [TournamentMatch];
    history : [OldHistory];
    nextRegistrationNumber : Nat;
    nextMatchId : Nat;
    nextActionId : Nat;
    updatedAt : Int;
  };
  type OldActor = {
    accessControlState : AccessControl.AccessControlState;
    users : Map.Map<UserId, User>;
    usernames : Map.Map<Text, UserId>;
    tournaments : Map.Map<Nat, Tournament>;
    tournamentStates : Map.Map<Nat, OldState>;
    counters : OldCounters;
    owner : OwnerState;
  };
  type NewActor = {
    accessControlState : AccessControl.AccessControlState;
    users : Map.Map<UserId, User>;
    usernames : Map.Map<Text, UserId>;
    tournaments : Map.Map<Nat, Tournament>;
    tournamentStates : Map.Map<Nat, TournamentStateData>;
    players : Map.Map<Nat, GlobalPlayer>;
    counters : Counters;
    owner : OwnerState;
    telegramConfig : TelegramConfigState;
    telegramLinks : Map.Map<Principal, TelegramLink>;
    telegramOwners : Map.Map<Text, Principal>;
    telegramChallenges : Map.Map<Principal, TelegramChallenge>;
    telegramCache : TelegramCacheState;
  };

  public func migration(old : OldActor) : NewActor {
    let players = Map.empty<Nat, GlobalPlayer>();
    let states = Map.empty<Nat, TournamentStateData>();
    var nextPlayerId = 0;
    // Names alone never prove identity. Each legacy registration receives a
    // distinct club identity, retained consistently in its undo snapshots.
    for ((tournamentId, state) in old.tournamentStates.entries().toArray().sort(func(a, b) = Nat.compare(a.0, b.0)).values()) {
      let identities = Map.empty<Nat, Nat>();
      func convert(item : OldPlayer) : TournamentPlayerData {
        let globalId = switch (identities.get(item.id)) {
          case (?id) { id };
          case null {
            let id = nextPlayerId;
            nextPlayerId += 1;
            identities.add(item.id, id);
            players.add(id, {
              id; name = item.name; skillLevel = item.skillLevel; userId = null;
              createdAt = item.registeredAt; updatedAt = state.updatedAt;
            });
            id;
          };
        };
        { item with globalPlayerId = ?globalId };
      };
      let registered = state.players.map(convert);
      let history : [TournamentHistoryEntry] = state.history.map(func entry = {
        action = entry.action;
        snapshot = { entry.snapshot with players = entry.snapshot.players.map(convert) };
      });
      states.add(tournamentId, { state with players = registered; history });
    };
    {
      accessControlState = old.accessControlState;
      users = old.users;
      usernames = old.usernames;
      tournaments = old.tournaments;
      tournamentStates = states;
      players;
      counters = { var nextTournamentId = old.counters.nextTournamentId; var nextPlayerId = nextPlayerId };
      owner = old.owner;
      telegramConfig = { var clientId = ?"8851986381" };
      telegramLinks = Map.empty();
      telegramOwners = Map.empty();
      telegramChallenges = Map.empty();
      telegramCache = { var keys = null };
    };
  };
};
