import { createActor } from "@/backend";
import { authService } from "@/services/auth";
import type { User } from "@/types";
import { useActor, useInternetIdentity } from "@caffeineai/core-infrastructure";
import { useQuery } from "@tanstack/react-query";

/**
 * Queries the authenticated caller's profile (channel).
 *
 * Returns `null` while signed out or when no profile exists yet.
 */
export function useCurrentUser() {
  const { actor, isFetching } = useActor(createActor);
  const { isAuthenticated } = useInternetIdentity();

  return useQuery<User | null>({
    queryKey: ["profile"],
    queryFn: async () => {
      if (!actor) return null;
      return authService.getCallerProfile(actor);
    },
    enabled: !!actor && !isFetching && isAuthenticated,
  });
}
