import Runtime "mo:core/Runtime";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import AccessControl "mo:caffeineai-authorization/access-control";
import Common "../types/common";
import Users "../types/users";
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
    RolesLib.effectiveRole(accessControlState, users, owner, caller);
  };

  // Admin-only. Lists authenticated accounts, including those without profiles.
  public query ({ caller }) func listUsersWithRoles() : async [Users.UserRoleView] {
    RolesLib.requireAdmin(accessControlState, caller);
    RolesLib.listAuthenticatedUsers(accessControlState, users, owner);
  };

  // Admin-only. Grants the admin role to `target`. Traps when the caller is
  // not an admin or when `target` is not a known account.
  public shared ({ caller }) func grantAdminRole(target : Common.UserId) : async Users.UserRoleView {
    switch (RolesLib.grantAdmin(accessControlState, users, caller, target)) {
      case (?u) { u };
      case null { Runtime.trap("User not found") };
    };
  };

  // Admin-only. Revokes the admin role from `target`. Traps when the caller is
  // not an admin, when `target` is not a known account, or when `target` is the
  // owner (the owner never loses admin access).
  public shared ({ caller }) func revokeAdminRole(target : Common.UserId) : async Users.UserRoleView {
    RolesLib.requireAdmin(accessControlState, caller);
    if (owner.ownerPrincipal == ?target) {
      Runtime.trap("Cannot revoke the owner's admin role");
    };
    switch (RolesLib.revokeAdmin(accessControlState, users, caller, target)) {
      case (?u) { u };
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
      case null {
        RolesLib.requireAdmin(accessControlState, caller);
        owner.ownerPrincipal := ?caller;
      };
      case (?_) {};
    };
    RolesLib.applyOwnerBootstrap(accessControlState, users, owner);
  };
};
