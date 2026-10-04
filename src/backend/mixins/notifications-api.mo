import Runtime "mo:core/Runtime";
import List "mo:core/List";
import Map "mo:core/Map";
import AccessControl "mo:caffeineai-authorization/access-control";
import Common "../types/common";
import Notifications "../types/notifications";
import NotificationsLib "../lib/notifications";

mixin (
  accessControlState : AccessControl.AccessControlState,
  notifications : Map.Map<Common.UserId, List.List<Notifications.Notification>>,
  counters : Common.Counters,
) {
  public query ({ caller }) func getNotifications(cursor : Common.Cursor, limit : Nat) : async Common.Page<Notifications.Notification> {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can perform this action");
    };
    NotificationsLib.listNotifications(notifications, caller, cursor, limit);
  };

  public query ({ caller }) func getUnreadNotificationCount() : async Nat {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      return 0;
    };
    NotificationsLib.getUnreadCount(notifications, caller);
  };

  public shared ({ caller }) func markNotificationsRead() : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can perform this action");
    };
    NotificationsLib.markAllRead(notifications, caller);
  };
};
