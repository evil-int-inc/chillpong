import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import List "mo:core/List";
import Map "mo:core/Map";
import Set "mo:core/Set";
import AccessControl "mo:caffeineai-authorization/access-control";
import Common "../types/common";
import Notifications "../types/notifications";
import SubscriptionsLib "../lib/subscriptions";
import NotificationsLib "../lib/notifications";

mixin (
  accessControlState : AccessControl.AccessControlState,
  subscriptions : Map.Map<Common.UserId, Set.Set<Common.UserId>>,
  subscribers : Map.Map<Common.UserId, Set.Set<Common.UserId>>,
  notifications : Map.Map<Common.UserId, List.List<Notifications.Notification>>,
  counters : Common.Counters,
) {
  public shared ({ caller }) func subscribe(channelId : Common.UserId) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can perform this action");
    };
    if (caller == channelId) {
      Runtime.trap("Cannot subscribe to yourself");
    };
    let now = Time.now();
    SubscriptionsLib.subscribe(subscriptions, subscribers, caller, channelId, now);
    ignore NotificationsLib.createNotification(notifications, counters, channelId, #newSubscriber({ channelId = channelId }), now);
  };

  public shared ({ caller }) func unsubscribe(channelId : Common.UserId) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can perform this action");
    };
    SubscriptionsLib.unsubscribe(subscriptions, subscribers, caller, channelId);
  };

  public query ({ caller }) func isSubscribed(channelId : Common.UserId) : async Bool {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      return false;
    };
    SubscriptionsLib.isSubscribed(subscriptions, caller, channelId);
  };

  public query ({ caller }) func getSubscribedChannels() : async [Common.UserId] {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      return [];
    };
    SubscriptionsLib.getSubscribedChannels(subscriptions, caller);
  };

  public query ({ caller }) func getSubscriberCount(channelId : Common.UserId) : async Nat {
    ignore caller;
    SubscriptionsLib.getSubscriberCount(subscribers, channelId);
  };
};
