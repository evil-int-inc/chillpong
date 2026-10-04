import Int "mo:core/Int";
import List "mo:core/List";
import Map "mo:core/Map";
import Common "../types/common";
import Notifications "../types/notifications";
import FeedLib "../lib/feed";

module {
  public func createNotification(
    notifications : Map.Map<Common.UserId, List.List<Notifications.Notification>>,
    counters : Common.Counters,
    recipientId : Common.UserId,
    kind : Notifications.NotificationKind,
    now : Common.Timestamp,
  ) : Nat {
    let id = counters.nextNotificationId;
    counters.nextNotificationId += 1;
    let notification : Notifications.Notification = { id; recipientId; kind; createdAt = now; read = false };
    let list = switch (notifications.get(recipientId)) {
      case (?l) { l };
      case null {
        let l = List.empty<Notifications.Notification>();
        notifications.add(recipientId, l);
        l;
      };
    };
    list.add(notification);
    id;
  };

  public func listNotifications(
    notifications : Map.Map<Common.UserId, List.List<Notifications.Notification>>,
    recipientId : Common.UserId,
    cursor : Common.Cursor,
    limit : Nat,
  ) : Common.Page<Notifications.Notification> {
    let list = switch (notifications.get(recipientId)) {
      case (?l) { l.toArray() };
      case null { [] };
    };
    let sorted = list.sort(func (a, b) = Int.compare(b.id, a.id));
    FeedLib.paginate(sorted, func n = n.id, cursor, limit);
  };

  public func getUnreadCount(
    notifications : Map.Map<Common.UserId, List.List<Notifications.Notification>>,
    recipientId : Common.UserId,
  ) : Nat {
    switch (notifications.get(recipientId)) {
      case (?l) { l.toArray().filter(func n = not n.read).size() };
      case null { 0 };
    };
  };

  public func markAllRead(
    notifications : Map.Map<Common.UserId, List.List<Notifications.Notification>>,
    recipientId : Common.UserId,
  ) : () {
    switch (notifications.get(recipientId)) {
      case (?l) {
        l.mapInPlace(func n = { n with read = true });
      };
      case null {};
    };
  };
};
