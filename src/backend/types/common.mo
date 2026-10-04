module {
  public type UserId = Principal;
  public type Timestamp = Int; // nanoseconds since epoch (Time.now())
  // Shared mutable counters, passed by reference to mixins that allocate ids.
  public type Counters = {
    var nextTournamentId : Nat;
  };
  // Owner bootstrap state. `ownerPrincipal` is the designated owner account
  // captured at setup; `ownerApplied` supports role reads before a profile
  // exists. Bootstrap restores the owner's admin role on every sign-in.
  public type OwnerState = {
    var ownerPrincipal : ?Principal;
    var ownerApplied : Bool;
  };
};
