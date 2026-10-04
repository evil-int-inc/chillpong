import { createActor } from "@/backend";
import { config } from "@/config";
import { notificationService } from "@/services/notifications";
import type { Notification, NotificationPage } from "@/types";
import { toNotificationPage } from "@/types";
import { useActor } from "@caffeineai/core-infrastructure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * Notifications hook.
 *
 * Provides the unread count, the most recent notifications, and a
 * mark-all-read action used by the header notification bell.
 */
export function useNotifications() {
  const { actor, isFetching } = useActor(createActor);
  const queryClient = useQueryClient();

  const unreadQuery = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: async () => {
      if (!actor) return 0n;
      return notificationService.getUnreadNotificationCount(actor);
    },
    enabled: !!actor && !isFetching,
  });

  const listQuery = useQuery<NotificationPage>({
    queryKey: ["notifications", "list"],
    queryFn: async () => {
      if (!actor) return { items: [] };
      const page = await notificationService.getNotifications(
        actor,
        0n,
        BigInt(config.notificationPageSize),
      );
      return toNotificationPage(page);
    },
    enabled: !!actor && !isFetching,
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Backend is not ready");
      await notificationService.markNotificationsRead(actor);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return {
    unreadCount: unreadQuery.data ?? 0n,
    notifications: listQuery.data?.items ?? ([] as Notification[]),
    notificationsLoading: listQuery.isLoading,
    markAllRead,
  };
}
