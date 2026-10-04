import Common "common";

module {
  public type TournamentFormat = { #singles; #doubles };
  public type TournamentStatus = { #upcoming; #live; #completed };

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
