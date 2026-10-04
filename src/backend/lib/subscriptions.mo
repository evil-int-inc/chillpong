import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Set "mo:core/Set";
import Common "../types/common";

module {
  public func subscribe(
    subscriptions : Map.Map<Common.UserId, Set.Set<Common.UserId>>,
    subscribers : Map.Map<Common.UserId, Set.Set<Common.UserId>>,
    subscriberId : Common.UserId,
    channelId : Common.UserId,
    now : Common.Timestamp,
  ) : () {
    ignore now;
    let subSet = switch (subscriptions.get(subscriberId)) {
      case (?s) { s };
      case null {
        let s = Set.empty<Common.UserId>();
        subscriptions.add(subscriberId, s);
        s;
      };
    };
    subSet.add(channelId);
    let subSet2 = switch (subscribers.get(channelId)) {
      case (?s) { s };
      case null {
        let s = Set.empty<Common.UserId>();
        subscribers.add(channelId, s);
        s;
      };
    };
    subSet2.add(subscriberId);
  };

  public func unsubscribe(
    subscriptions : Map.Map<Common.UserId, Set.Set<Common.UserId>>,
    subscribers : Map.Map<Common.UserId, Set.Set<Common.UserId>>,
    subscriberId : Common.UserId,
    channelId : Common.UserId,
  ) : () {
    switch (subscriptions.get(subscriberId)) {
      case (?s) { s.remove(channelId) };
      case null {};
    };
    switch (subscribers.get(channelId)) {
      case (?s) { s.remove(subscriberId) };
      case null {};
    };
  };

  public func isSubscribed(
    subscriptions : Map.Map<Common.UserId, Set.Set<Common.UserId>>,
    subscriberId : Common.UserId,
    channelId : Common.UserId,
  ) : Bool {
    switch (subscriptions.get(subscriberId)) {
      case (?s) { s.contains(channelId) };
      case null { false };
    };
  };

  public func getSubscribedChannels(
    subscriptions : Map.Map<Common.UserId, Set.Set<Common.UserId>>,
    subscriberId : Common.UserId,
  ) : [Common.UserId] {
    switch (subscriptions.get(subscriberId)) {
      case (?s) { s.toArray() };
      case null { [] };
    };
  };

  public func getSubscriberCount(
    subscribers : Map.Map<Common.UserId, Set.Set<Common.UserId>>,
    channelId : Common.UserId,
  ) : Nat {
    switch (subscribers.get(channelId)) {
      case (?s) { s.size() };
      case null { 0 };
    };
  };
};
