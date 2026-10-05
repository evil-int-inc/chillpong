import Runtime "mo:core/Runtime";
import Map "mo:core/Map";
import Iter "mo:core/Iter";
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

  // A sign-in registers the principal in the authorization map even when the
  // member has never created a profile. Profile metadata is optional here.
  public func accountRoleView(
    accessControlState : AccessControl.AccessControlState,
    users : Map.Map<Common.UserId, Users.User>,
    userId : Common.UserId,
    role : ?Users.Role,
  ) : ?Users.UserRoleView {
    if (userId.isAnonymous()) { return null };
    switch (users.get(userId)) {
      case (?user) {
        ?{ id = userId; displayName = user.displayName; username = user.username; role };
      };
      case null {
        switch (accessControlState.userRoles.get(userId)) {
          case null { null };
          case (?_) { ?{ id = userId; displayName = "Signed-in member"; username = ""; role } };
        };
      };
    };
  };

  public func listAuthenticatedUsers(
    accessControlState : AccessControl.AccessControlState,
    users : Map.Map<Common.UserId, Users.User>,
    owner : Common.OwnerState,
  ) : [Users.UserRoleView] {
    accessControlState.userRoles.keys().filterMap(func userId = accountRoleView(
      accessControlState, users, userId, effectiveRole(accessControlState, users, owner, userId)
    )).toArray();
  };

  // Grants the app-level admin role to `target` and keeps the authorization
  // package's role in sync (#admin). A signed-in account needs no profile.
  public func grantAdmin(
    accessControlState : AccessControl.AccessControlState,
    users : Map.Map<Common.UserId, Users.User>,
    caller : Principal,
    target : Common.UserId,
  ) : ?Users.UserRoleView {
    requireAdmin(accessControlState, caller);
    switch (accountRoleView(accessControlState, users, target, ?#admin)) {
      case (?updated) {
        AccessControl.assignRole(accessControlState, caller, target, #admin);
        ignore UsersLib.setRole(users, target, ?#admin);
        ?updated;
      };
      case null { null };
    };
  };

  // Revokes the app-level admin role from `target` and keeps the authorization
  // package's role in sync (#user). A signed-in account needs no profile.
  public func revokeAdmin(
    accessControlState : AccessControl.AccessControlState,
    users : Map.Map<Common.UserId, Users.User>,
    caller : Principal,
    target : Common.UserId,
  ) : ?Users.UserRoleView {
    requireAdmin(accessControlState, caller);
    switch (accountRoleView(accessControlState, users, target, null)) {
      case (?updated) {
        AccessControl.assignRole(accessControlState, caller, target, #user);
        ignore UsersLib.setRole(users, target, null);
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
