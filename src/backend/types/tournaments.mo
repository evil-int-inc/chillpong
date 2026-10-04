import Common "common";

module {
  public type TournamentFormat = { #singles; #doubles };
  public type TournamentStatus = { #upcoming; #live; #completed };

  public type TournamentElimination = { #singleElimination; #doubleElimination };
  public type TournamentSlot = { #a; #b };
  public type TournamentBracket = { #winners; #losers; #grandFinal; #resetFinal };
  public type MatchSource = { #player : Nat; #winner : Nat; #loser : Nat; #bye };
  public type TournamentMatchStatus = { #blocked; #ready; #playing; #completed; #bye; #cancelled };
  public type TournamentPlayerStatus = { #waiting; #ready; #playing; #advanced; #eliminated; #champion; #removed };
  public type TournamentTableStatus = { #available; #waiting; #playing; #finished };

  public type TournamentPlayerData = {
    id : Nat;
    name : Text;
    skillLevel : Nat;
    registrationNumber : Nat;
    registeredAt : Common.Timestamp;
    removed : Bool;
    queuePriority : Int;
  };

  public type TournamentPlayer = {
    id : Nat;
    name : Text;
    skillLevel : Nat;
    registrationNumber : Nat;
    registeredAt : Common.Timestamp;
    seed : ?Nat;
    status : TournamentPlayerStatus;
    currentMatchId : ?Nat;
    table : ?Nat;
    losses : Nat;
  };

  public type TournamentMatch = {
    id : Nat;
    bracket : TournamentBracket;
    round : Nat;
    position : Nat;
    sourceA : MatchSource;
    sourceB : MatchSource;
    playerA : ?Nat;
    playerB : ?Nat;
    scoreA : ?Nat;
    scoreB : ?Nat;
    winnerId : ?Nat;
    loserId : ?Nat;
    status : TournamentMatchStatus;
    table : ?Nat;
    priority : Int;
    manualOverride : Bool;
  };

  public type TournamentTable = {
    number : Nat;
    status : TournamentTableStatus;
    matchId : ?Nat;
  };

  public type TournamentAction = {
    id : Nat;
    caption : Text;
    createdAt : Common.Timestamp;
  };

  public type TournamentSnapshot = {
    elimination : TournamentElimination;
    tableCount : Nat;
    started : Bool;
    players : [TournamentPlayerData];
    matches : [TournamentMatch];
  };

  public type TournamentHistoryEntry = {
    action : TournamentAction;
    snapshot : TournamentSnapshot;
  };

  public type TournamentStateData = {
    elimination : TournamentElimination;
    tableCount : Nat;
    started : Bool;
    players : [TournamentPlayerData];
    matches : [TournamentMatch];
    history : [TournamentHistoryEntry];
    nextRegistrationNumber : Nat;
    nextMatchId : Nat;
    nextActionId : Nat;
    updatedAt : Common.Timestamp;
  };

  public type TournamentState = {
    tournamentId : Nat;
    elimination : TournamentElimination;
    tableCount : Nat;
    started : Bool;
    players : [TournamentPlayer];
    matches : [TournamentMatch];
    waitingQueue : [Nat];
    nextMatches : [Nat];
    tables : [TournamentTable];
    championId : ?Nat;
    history : [TournamentAction];
    canUndo : Bool;
    updatedAt : Common.Timestamp;
  };

  public type TournamentCommand = {
    #configure : { elimination : TournamentElimination; tableCount : Nat };
    #addPlayer : { name : Text; skillLevel : Nat };
    #editPlayer : { playerId : Nat; name : Text; skillLevel : Nat };
    #removePlayer : { playerId : Nat; confirmed : Bool };
    #generateBracket;
    #placePlayer : { playerId : Nat; matchId : Nat; slot : TournamentSlot };
    #movePlayer : { playerId : Nat; matchId : Nat; slot : TournamentSlot };
    #swapPlayers : { firstMatchId : Nat; firstSlot : TournamentSlot; secondMatchId : Nat; secondSlot : TournamentSlot };
    #setMatchPlayers : { matchId : Nat; playerA : ?Nat; playerB : ?Nat };
    #assignBye : { matchId : Nat; slot : TournamentSlot };
    #assignTable : { matchId : Nat; table : ?Nat };
    #startMatch : Nat;
    #recordResult : { matchId : Nat; scoreA : Nat; scoreB : Nat };
    #resetMatch : { matchId : Nat; cascade : Bool };
    #prioritizeMatch : Nat;
    #prioritizePlayer : Nat;
    #undo;
  };

  public type TournamentInput = {
    title : Text;
    description : Text;
    venue : Text;
    startsAt : Common.Timestamp;
    format : TournamentFormat;
    capacity : Nat;
    status : TournamentStatus;
  };

  public type Tournament = {
    id : Nat;
    title : Text;
    description : Text;
    venue : Text;
    startsAt : Common.Timestamp;
    format : TournamentFormat;
    capacity : Nat;
    status : TournamentStatus;
    createdAt : Common.Timestamp;
    updatedAt : Common.Timestamp;
  };
};
