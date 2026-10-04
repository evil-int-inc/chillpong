import Runtime "mo:core/Runtime";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import AccessControl "mo:caffeineai-authorization/access-control";
import Common "../types/common";
import Users "../types/users";
import UsersLib "../lib/users";
import RolesLib "../lib/roles";

mixin (
  accessControlState : AccessControl.AccessControlState,
  users : Map.Map<Common.UserId, Users.User>,
  owner : Common.OwnerState,
) {
  // Returns the caller's app-level role: `?{ #admin }` for an admin, `null`
  // for a regular user. Anonymous callers receive `null`. The owner is reported
  // as admin once the owner bootstrap has been applied, even before a profile
  // record exists.
  public query ({ caller }) func getMyRole() : async ?Users.Role {
    switch (UsersLib.getUser(users, caller)) {
      case (?u) {
        switch (u.role) {
          case (?#admin) { ?#admin };
          case null {
            if (owner.ownerPrincipal == ?caller and owner.ownerApplied) { ?#admin } else { null };
          };
        };
      };
      case null {
        if (owner.ownerPrincipal == ?caller and owner.ownerApplied) { ?#admin } else { null };
      };
    };
  };

  // Admin-only. Lists every user with their current role.
  public query ({ caller }) func listUsersWithRoles() : async [Users.UserRoleView] {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin)) {
      Runtime.trap("Unauthorized: Only admins can perform this action");
    };
    UsersLib.listUserRoles(users);
  };

  // Admin-only. Grants the admin role to `target`. Traps when the caller is
  // not an admin or when `target` has no user record.
  public shared ({ caller }) func grantAdminRole(target : Common.UserId) : async Users.UserRoleView {
    switch (RolesLib.grantAdmin(accessControlState, users, caller, target)) {
      case (?u) { { id = u.id; displayName = u.displayName; username = u.username; role = u.role } };
      case null { Runtime.trap("User not found") };
    };
  };

  // Admin-only. Revokes the admin role from `target`. Traps when the caller is
  // not an admin, when `target` has no user record, or when `target` is the
  // owner (the owner never loses admin access).
  public shared ({ caller }) func revokeAdminRole(target : Common.UserId) : async Users.UserRoleView {
    if (owner.ownerPrincipal == ?target) {
      Runtime.trap("Cannot revoke the owner's admin role");
    };
    switch (RolesLib.revokeAdmin(accessControlState, users, caller, target)) {
      case (?u) { { id = u.id; displayName = u.displayName; username = u.username; role = u.role } };
      case null { Runtime.trap("User not found") };
    };
  };

  // Applies the owner bootstrap for the caller. Called by the owner account
  // after sign-in; records the caller as the owner on first call and grants the
  // owner the admin role. Safe to call repeatedly (idempotent).
  public shared ({ caller }) func bootstrapOwner() : async () {
    if (caller.isAnonymous()) {
      Runtime.trap("Unauthorized: Only users can perform this action");
    };
    switch (owner.ownerPrincipal) {
      case null { owner.ownerPrincipal := ?caller };
      case (?_) {};
    };
    RolesLib.applyOwnerBootstrap(accessControlState, users, owner);
  };
};
