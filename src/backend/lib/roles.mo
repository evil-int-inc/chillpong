import Runtime "mo:core/Runtime";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import AccessControl "mo:caffeineai-authorization/access-control";
import Common "../types/common";
import Users "../types/users";
import UsersLib "../lib/users";

module {
  // The package can also assign roles through its generic API. Its registered
  // role is authoritative; unregistered users retain their stored app role.
  public func effectiveRole(
    accessControlState : AccessControl.AccessControlState,
    users : Map.Map<Common.UserId, Users.User>,
    owner : Common.OwnerState,
    userId : Common.UserId,
  ) : ?Users.Role {
    if (owner.ownerPrincipal == ?userId and owner.ownerApplied) { return ?#admin };
    switch (accessControlState.userRoles.get(userId)) {
      case (?#admin) { ?#admin };
      case (?_) { null };
      case null {
        switch (users.get(userId)) {
          case (?user) { user.role };
          case null { null };
        };
      };
    };
  };

  // Read the role map directly so unregistered callers receive the same
  // denial as regular users instead of a role-lookup trap.
  public func requireAdmin(
    accessControlState : AccessControl.AccessControlState,
    caller : Principal,
  ) : () {
    if (caller.isAnonymous() or accessControlState.userRoles.get(caller) != ?#admin) {
      Runtime.trap("Unauthorized: Only admins can perform this action");
    };
  };

  // Grants the app-level admin role to `target` and keeps the authorization
  // package's role in sync (#admin). Returns the updated user, or null when
  // no user record exists for `target`.
  public func grantAdmin(
    accessControlState : AccessControl.AccessControlState,
    users : Map.Map<Common.UserId, Users.User>,
    caller : Principal,
    target : Common.UserId,
  ) : ?Users.User {
    requireAdmin(accessControlState, caller);
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
    requireAdmin(accessControlState, caller);
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
  // so the owner keeps admin access across upgrades and role resynchronization.
  // The owner is captured only from an authenticated admin during bootstrap.
  public func applyOwnerBootstrap(
    accessControlState : AccessControl.AccessControlState,
    users : Map.Map<Common.UserId, Users.User>,
    owner : Common.OwnerState,
  ) : () {
    switch (owner.ownerPrincipal) {
      case null { () };
      case (?p) {
        accessControlState.userRoles.add(p, #admin);
        ignore UsersLib.setRole(users, p, ?#admin);
        owner.ownerApplied := true;
      };
    };
  };
};
