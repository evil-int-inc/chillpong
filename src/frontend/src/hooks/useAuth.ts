import { createActor } from "@/backend";
import { authService } from "@/services/auth";
import { useActor, useInternetIdentity } from "@caffeineai/core-infrastructure";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

/**
 * Authentication + caller profile/role hook.
 *
 * Wraps Internet Identity state and exposes the authenticated caller's
 * principal, member profile, and admin role. After sign-in it calls
 * `bootstrapOwner()` once so the owner account receives the admin role on its
 * first sign-in; the call is idempotent and safe for non-owners.
 */
export function useAuth() {
  const {
    identity,
    login,
    clear,
    isAuthenticated,
    isInitializing,
    isLoggingIn,
  } = useInternetIdentity();

  const { actor, isFetching } = useActor(createActor);
  const queryClient = useQueryClient();

  const principal = identity?.getPrincipal().toString() ?? null;

  const profileQuery = useQuery({
    queryKey: ["profile", principal],
    queryFn: async () => {
      if (!actor) return null;
      return authService.getCallerProfile(actor);
    },
    enabled: !!actor && !isFetching && isAuthenticated,
  });

  const roleQuery = useQuery({
    queryKey: ["myRole", principal],
    queryFn: async () => {
      if (!actor) return null;
      return authService.getMyRole(actor);
    },
    enabled: !!actor && !isFetching && isAuthenticated,
  });

  const bootstrappedRef = useRef(false);

  useEffect(() => {
    if (!actor || isFetching || !isAuthenticated) {
      bootstrappedRef.current = false;
      return;
    }
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    let cancelled = false;
    void authService
      .bootstrapOwner(actor)
      .then(() => {
        if (cancelled) return;
        void queryClient.invalidateQueries({ queryKey: ["myRole"] });
      })
      .catch(() => {
        // Non-owners and transient failures are expected; role stays null.
      });

    return () => {
      cancelled = true;
    };
  }, [actor, isFetching, isAuthenticated, queryClient]);

  return {
    identity,
    principal,
    login,
    logout: clear,
    isAuthenticated,
    isInitializing,
    isLoggingIn,
    profile: isAuthenticated ? (profileQuery.data ?? null) : null,
    profileLoading: profileQuery.isLoading,
    role: isAuthenticated ? (roleQuery.data ?? null) : null,
    isAdmin: isAuthenticated && !isFetching && roleQuery.data === "admin",
    roleLoading: roleQuery.isLoading,
  };
}
