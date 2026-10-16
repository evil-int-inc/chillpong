import Map "mo:core/Map";
import Principal "mo:core/Principal";

module {
  type Role = { #admin };
  type OldUser = {
    id : Principal;
    displayName : Text;
    username : Text;
    avatar : ?Blob;
    bio : ?Text;
    createdAt : Int;
    role : ?Role;
  };
  type NewUser = OldUser and { avatarUrl : ?Text };
  type OldActor = { users : Map.Map<Principal, OldUser> };
  type NewActor = { users : Map.Map<Principal, NewUser> };

  public func migration(old : OldActor) : NewActor {
    { users = old.users.map(func(_, user) = { user with avatarUrl = null }) };
  };
};
