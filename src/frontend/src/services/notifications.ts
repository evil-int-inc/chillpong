import type { Backend } from "@/backend";
import type { Cursor, Notification, NotificationPage } from "@/types";
import { toNotificationPage } from "@/types";

/** Backend operations for the caller's notifications. */
export class NotificationService {
  /** Fetches a cursor-paginated page of the caller's notifications. */
  async getNotifications(
    actor: Backend,
    cursor: Cursor,
    limit: bigint,
  ): Promise<NotificationPage> {
    return toNotificationPage(await actor.getNotifications(cursor, limit));
  }

  /** Returns the caller's unread notification count. */
  getUnreadNotificationCount(actor: Backend): Promise<bigint> {
    return actor.getUnreadNotificationCount();
  }

  /** Marks all of the caller's notifications as read. */
  markNotificationsRead(actor: Backend): Promise<void> {
    return actor.markNotificationsRead();
  }
}

export const notificationService = new NotificationService();

/** Convenience type re-export for consumers. */
export type { Notification };
