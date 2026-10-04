/**
 * Backward-compatible re-exports for the canonical auth and notifications
 * hooks, so existing importers (Header, NotificationBell) keep working.
 */
export { useAuth } from "@/hooks/useAuth";
export { useNotifications } from "@/hooks/useNotifications";
