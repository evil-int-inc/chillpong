import Map "mo:core/Map";
import Set "mo:core/Set";
import AccessControl "mo:caffeineai-authorization/access-control";
import Common "../types/common";
import Videos "../types/videos";
import FeedLib "../lib/feed";

mixin (
  accessControlState : AccessControl.AccessControlState,
  videos : Map.Map<Nat, Videos.Video>,
  subscriptions : Map.Map<Common.UserId, Set.Set<Common.UserId>>,
) {
  public query ({ caller }) func getFeed(cursor : Common.Cursor, limit : Nat) : async Common.Page<Videos.Video> {
    ignore caller;
    FeedLib.getFeed(videos, cursor, limit);
  };

  public query ({ caller }) func getSubscriptionFeed(cursor : Common.Cursor, limit : Nat) : async Common.Page<Videos.Video> {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      return { items = [] : [Videos.Video]; nextCursor = null };
    };
    FeedLib.getSubscriptionFeed(videos, subscriptions, caller, cursor, limit);
  };

  public query ({ caller }) func getChannelVideos(userId : Common.UserId, cursor : Common.Cursor, limit : Nat) : async Common.Page<Videos.Video> {
    FeedLib.getChannelVideos(videos, userId, caller, cursor, limit);
  };
};
