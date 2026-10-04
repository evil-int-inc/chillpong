import { useNotifications } from "@/services/hooks";
import type { Notification } from "@/types";
import { timeAgo, timestampToDate } from "@/utils/format";
import { Bell, CheckCheck, Clapperboard, UserPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

function notificationLabel(notification: Notification): string {
  switch (notification.kind.__kind__) {
    case "newVideo":
      return "A channel you follow uploaded a new video";
    case "newSubscriber":
      return "You have a new subscriber";
    default:
      return "New notification";
  }
}

function NotificationIcon({ notification }: { notification: Notification }) {
  if (notification.kind.__kind__ === "newVideo") {
    return (
      <Clapperboard
        className="size-4 shrink-0 text-primary"
        aria-hidden="true"
      />
    );
  }
  return (
    <UserPlus className="size-4 shrink-0 text-primary" aria-hidden="true" />
  );
}

/**
 * Header notification bell. Shows an unread-count badge and a dropdown of the
 * most recent notifications with a mark-all-read action.
 */
export function NotificationBell() {
  const { unreadCount, notifications, notificationsLoading, markAllRead } =
    useNotifications();

  const count = Number(unreadCount);
  const hasUnread = count > 0;
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div
      ref={dropdownRef}
      className={`dropdown dropdown-end ${isOpen ? "dropdown-open" : ""}`}
    >
      <button
        type="button"
        data-ocid="notification_bell"
        aria-label={
          hasUnread
            ? `Notifications, ${count} unread`
            : "Notifications, no unread"
        }
        className="btn btn-ghost btn-circle btn-sm relative"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <Bell className="size-5" aria-hidden="true" />
        {hasUnread ? (
          <span
            data-ocid="notification_badge"
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground"
          >
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          data-ocid="notification_dropdown"
          aria-label="Notifications"
          className="dropdown-content z-50 mt-2 w-80 max-w-[calc(100vw-1rem)] rounded-box border border-border bg-popover shadow-elevated"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-display text-sm font-semibold text-foreground">
              Notifications
            </h2>
            {hasUnread ? (
              <button
                type="button"
                data-ocid="mark_all_read_button"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80 disabled:opacity-50"
              >
                <CheckCheck className="size-3.5" aria-hidden="true" />
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notificationsLoading ? (
              <div className="space-y-3 p-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="size-8 shrink-0 animate-pulse rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                      <div className="h-2.5 w-1/3 animate-pulse rounded bg-muted" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div
                data-ocid="notification_empty_state"
                className="flex flex-col items-center gap-2 px-4 py-10 text-center"
              >
                <Bell
                  className="size-6 text-muted-foreground"
                  aria-hidden="true"
                />
                <p className="text-sm text-muted-foreground">
                  No notifications yet
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {notifications.map((notification) => {
                  const date = timestampToDate(notification.createdAt);
                  return (
                    <li
                      key={notification.id.toString()}
                      data-ocid="notification_item"
                      className={`flex items-start gap-3 px-4 py-3 ${
                        notification.read ? "" : "bg-primary/5"
                      }`}
                    >
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                        <NotificationIcon notification={notification} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-snug text-foreground">
                          {notificationLabel(notification)}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {timeAgo(date)}
                        </p>
                      </div>
                      {!notification.read ? (
                        <span
                          className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                          aria-label="Unread"
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
