import Runtime "mo:core/Runtime";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import AccessControl "mo:caffeineai-authorization/access-control";
import Common "../types/common";
import Users "../types/users";
import UsersLib "../lib/users";

module {
  // Grants the app-level admin role to `target` and keeps the authorization
  // package's role in sync (#admin). Returns the updated user, or null when
  // no user record exists for `target`.
  public func grantAdmin(
    accessControlState : AccessControl.AccessControlState,
    users : Map.Map<Common.UserId, Users.User>,
    caller : Principal,
    target : Common.UserId,
  ) : ?Users.User {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Only admins can perform this action");
    };
    switch (UsersLib.setRole(users, target, ?#admin)) {
      case (?updated) {
        AccessControl.assignRole(accessControlState, caller, target, #admin);
        ?updated;
      };
      case null { null };
    };
  };

  // Revokes the app-level admin role from `target` and keeps the authorization
  // package's role in sync (#user). Returns the updated user, or null when
  // no user record exists for `target`.
  public func revokeAdmin(
    accessControlState : AccessControl.AccessControlState,
    users : Map.Map<Common.UserId, Users.User>,
    caller : Principal,
    target : Common.UserId,
  ) : ?Users.User {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Only admins can perform this action");
    };
    switch (UsersLib.setRole(users, target, null)) {
      case (?updated) {
        AccessControl.assignRole(accessControlState, caller, target, #user);
        ?updated;
      };
      case null { null };
    };
  };

  // Applies the owner bootstrap: when `owner.ownerPrincipal` is set, mirrors the
  // owner's authorization-package admin role onto the app-level `User.role` and
  // marks the bootstrap applied. Idempotent and safe to call on every sign-in,
  // so the owner keeps admin access across upgrades. The owner is the first
  // registrant and is therefore already `#admin` in the authorization package;
  // if that is not the case, nothing is applied.
  public func applyOwnerBootstrap(
    accessControlState : AccessControl.AccessControlState,
    users : Map.Map<Common.UserId, Users.User>,
    owner : Common.OwnerState,
  ) : () {
    switch (owner.ownerPrincipal) {
      case null { () };
      case (?p) {
        if (AccessControl.isAdmin(accessControlState, p)) {
          ignore UsersLib.setRole(users, p, ?#admin);
          owner.ownerApplied := true;
        };
      };
    };
  };
};
