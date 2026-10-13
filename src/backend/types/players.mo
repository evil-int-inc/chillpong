import Common "common";

module {
  // Club identity is independent of a tournament's monotonic registration ID.
  public type GlobalPlayer = {
    id : Nat;
    name : Text;
    skillLevel : Nat;
    userId : ?Common.UserId;
    createdAt : Common.Timestamp;
    updatedAt : Common.Timestamp;
  };

  public type PlayerInput = { name : Text; skillLevel : Nat };
};
