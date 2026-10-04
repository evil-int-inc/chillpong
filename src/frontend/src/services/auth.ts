import type { Backend, Role } from "@/backend";
import type { User } from "@/types";

/** Backend operations for the authenticated caller. */
export class AuthService {
  /**
   * Fetches the authenticated caller's member profile.
   * Returns `null` when the caller has no member record yet.
   */
  getCallerProfile(actor: Backend): Promise<User | null> {
    return actor.getCallerProfile();
  }

  /**
   * Fetches the authenticated caller's role.
   * Returns `null` for regular users (no admin role).
   */
  getMyRole(actor: Backend): Promise<Role | null> {
    return actor.getMyRole();
  }

  /**
   * Idempotently applies the admin role to the owner account. Safe to call for
   * any caller: non-owners are unaffected.
   */
  bootstrapOwner(actor: Backend): Promise<void> {
    return actor.bootstrapOwner();
  }
}

export const authService = new AuthService();
