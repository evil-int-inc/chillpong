import List "mo:core/List";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Set "mo:core/Set";
import AccessControl "mo:caffeineai-authorization/access-control";

module {
  type UserId = Principal;
  type Timestamp = Int;

  type OldCounters = {
    var nextVideoId : Nat;
    var nextUploadSessionId : Nat;
    var nextNotificationId : Nat;
    var nextPlaylistId : Nat;
  };

  type Role = { #admin };

  type User = {
    id : UserId;
    displayName : Text;
    username : Text;
    avatar : ?Blob;
    bio : ?Text;
    createdAt : Timestamp;
    role : ?Role;
  };

  type VideoStatus = { #draft; #processing; #published; #deleted };

  type Video = {
    id : Nat;
    ownerId : UserId;
    title : Text;
    description : ?Text;
    video : Blob;
    thumbnail : ?Blob;
    filename : Text;
    mimeType : Text;
    fileSize : Nat;
    viewCount : Nat;
    isPrivate : Bool;
    createdAt : Timestamp;
    publishedAt : ?Timestamp;
    status : VideoStatus;
  };

  type Playlist = {
    id : Nat;
    ownerId : UserId;
    title : Text;
    videoIds : [Nat];
    isPrivate : Bool;
    createdAt : Timestamp;
    updatedAt : Timestamp;
  };

  type UploadKind = { #video; #thumbnail };
  type UploadStatus = { #active; #completed; #finalized; #cancelled };

  type UploadSession = {
    id : Nat;
    ownerId : UserId;
    kind : UploadKind;
    assetId : Text;
    mimeType : Text;
    totalSize : Nat;
    chunkSize : Nat;
    receivedBytes : Nat;
    status : UploadStatus;
    createdAt : Timestamp;
  };

  type NotificationKind = {
    #newSubscriber : { channelId : UserId };
    #newVideo : { channelId : UserId; videoId : Nat };
  };

  type Notification = {
    id : Nat;
    recipientId : UserId;
    kind : NotificationKind;
    createdAt : Timestamp;
    read : Bool;
  };

  type StorageState = { var providers : [Text] };

  type OwnerState = {
    var ownerPrincipal : ?Principal;
    var ownerApplied : Bool;
  };

  type OldActor = {
    accessControlState : AccessControl.AccessControlState;
    users : Map.Map<UserId, User>;
    usernames : Map.Map<Text, UserId>;
    videos : Map.Map<Nat, Video>;
    playlists : Map.Map<Nat, Playlist>;
    uploadSessions : Map.Map<Nat, UploadSession>;
    counters : OldCounters;
    subscriptions : Map.Map<UserId, Set.Set<UserId>>;
    subscribers : Map.Map<UserId, Set.Set<UserId>>;
    notifications : Map.Map<UserId, List.List<Notification>>;
    storage : StorageState;
    owner : OwnerState;
  };

  type Counters = { var nextTournamentId : Nat };

  type TournamentFormat = { #singles; #doubles };
  type TournamentStatus = { #upcoming; #live; #completed };

  type Tournament = {
    id : Nat;
    title : Text;
    description : Text;
    venue : Text;
    startsAt : Timestamp;
    format : TournamentFormat;
    capacity : Nat;
    status : TournamentStatus;
    createdAt : Timestamp;
    updatedAt : Timestamp;
  };

  type TournamentElimination = { #singleElimination; #doubleElimination };
  type TournamentSlot = { #a; #b };
  type TournamentBracket = { #winners; #losers; #grandFinal; #resetFinal };
  type MatchSource = { #player : Nat; #winner : Nat; #loser : Nat; #bye };
  type TournamentMatchStatus = { #blocked; #ready; #playing; #completed; #bye; #cancelled };
  type TournamentPlayerStatus = { #waiting; #ready; #playing; #advanced; #eliminated; #champion; #removed };
  type TournamentTableStatus = { #available; #waiting; #playing; #finished };

  type TournamentPlayerData = {
    id : Nat;
    name : Text;
    skillLevel : Nat;
    registrationNumber : Nat;
    registeredAt : Timestamp;
    removed : Bool;
    queuePriority : Int;
  };

  type TournamentPlayer = {
    id : Nat;
    name : Text;
    skillLevel : Nat;
    registrationNumber : Nat;
    registeredAt : Timestamp;
    seed : ?Nat;
    status : TournamentPlayerStatus;
    currentMatchId : ?Nat;
    table : ?Nat;
    losses : Nat;
  };

  type TournamentMatch = {
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

  type TournamentTable = {
    number : Nat;
    status : TournamentTableStatus;
    matchId : ?Nat;
  };

  type TournamentAction = {
    id : Nat;
    caption : Text;
    createdAt : Timestamp;
  };

  type TournamentSnapshot = {
    elimination : TournamentElimination;
    tableCount : Nat;
    started : Bool;
    players : [TournamentPlayerData];
    matches : [TournamentMatch];
  };

  type TournamentHistoryEntry = {
    action : TournamentAction;
    snapshot : TournamentSnapshot;
  };

  type TournamentStateData = {
    elimination : TournamentElimination;
    tableCount : Nat;
    started : Bool;
    players : [TournamentPlayerData];
    matches : [TournamentMatch];
    history : [TournamentHistoryEntry];
    nextRegistrationNumber : Nat;
    nextMatchId : Nat;
    nextActionId : Nat;
    updatedAt : Timestamp;
  };


  type NewActor = {
    accessControlState : AccessControl.AccessControlState;
    users : Map.Map<UserId, User>;
    usernames : Map.Map<Text, UserId>;
    tournaments : Map.Map<Nat, Tournament>;
    tournamentStates : Map.Map<Nat, TournamentStateData>;
    counters : Counters;
    owner : OwnerState;
  };

  // The retired media, subscription, notification, upload, and provider maps
  // are consumed by OldActor and intentionally absent from the new state.
  public func migration(old : OldActor) : NewActor {
    {
      accessControlState = old.accessControlState;
      users = old.users;
      usernames = old.usernames;
      tournaments = Map.empty();
      tournamentStates = Map.empty();
      counters = { var nextTournamentId = 0 };
      owner = old.owner;
    };
  };
};
