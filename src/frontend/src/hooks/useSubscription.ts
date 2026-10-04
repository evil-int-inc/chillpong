import { createActor } from "@/backend";
import { subscriptionService } from "@/services/subscriptions";
import type { UserId } from "@/types";
import { useActor, useInternetIdentity } from "@caffeineai/core-infrastructure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * Subscribe / unsubscribe toggle for a channel.
 *
 * Exposes the current subscription state, the channel's subscriber count,
 * and a `toggle` mutation that subscribes or unsubscribes accordingly.
 */
export function useSubscription(channelId: UserId) {
  const { actor, isFetching } = useActor(createActor);
  const { isAuthenticated } = useInternetIdentity();
  const queryClient = useQueryClient();

  const subscribedQuery = useQuery({
    queryKey: ["subscription", "state", channelId.toString()],
    queryFn: async () => {
      if (!actor) return false;
      return subscriptionService.isSubscribed(actor, channelId);
    },
    enabled: !!actor && !isFetching && isAuthenticated,
  });

  const subscriberCountQuery = useQuery({
    queryKey: ["subscription", "count", channelId.toString()],
    queryFn: async () => {
      if (!actor) return 0n;
      return subscriptionService.getSubscriberCount(actor, channelId);
    },
    enabled: !!actor && !isFetching,
  });

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Backend is not ready");
      await subscriptionService.subscribe(actor, channelId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["subscription", channelId.toString()],
      });
    },
  });

  const unsubscribeMutation = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Backend is not ready");
      await subscriptionService.unsubscribe(actor, channelId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["subscription", channelId.toString()],
      });
    },
  });

  return {
    isSubscribed: subscribedQuery.data ?? false,
    subscriberCount: subscriberCountQuery.data ?? 0n,
    isPending: subscribeMutation.isPending || unsubscribeMutation.isPending,
    subscribe: () => subscribeMutation.mutate(),
    unsubscribe: () => unsubscribeMutation.mutate(),
  };
}
