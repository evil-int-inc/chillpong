import Array "mo:core/Array";
import Int "mo:core/Int";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Set "mo:core/Set";
import Common "../types/common";
import Videos "../types/videos";

module {
  // Generic newest-first cursor pagination over an array already sorted by
  // descending id. cursor == 0 means "first page"; otherwise it is the id of
  // the last item already returned, and only items with a strictly smaller id
  // are considered.
  public func paginate<T>(items : [T], getId : T -> Nat, cursor : Common.Cursor, limit : Nat) : Common.Page<T> {
    if (limit == 0) {
      return { items = []; nextCursor = null };
    };
    let filtered = if (cursor == 0) {
      items;
    } else {
      items.filter(func item = getId(item) < cursor);
    };
    let hasMore = filtered.size() > limit;
    let n = if (hasMore) { limit } else { filtered.size() };
    let page = Array.tabulate(n, func i = filtered[i]);
    let nextCursor = if (hasMore) { ?getId(page[n - 1]) } else { null };
    { items = page; nextCursor };
  };

  func publishedSorted(
    videos : Map.Map<Nat, Videos.Video>,
    includePrivate : Bool,
    predicate : Videos.Video -> Bool,
  ) : [Videos.Video] {
    videos.entries()
      .toArray()
      .filter(func (_, v) = v.status == #published and (includePrivate or not v.isPrivate) and predicate(v))
      .map(func (_, v) = v)
      .sort(func (a, b) = Int.compare(b.id, a.id));
  };

  public func getFeed(
    videos : Map.Map<Nat, Videos.Video>,
    cursor : Common.Cursor,
    limit : Nat,
  ) : Common.Page<Videos.Video> {
    let published = publishedSorted(videos, false, func _ = true);
    paginate(published, func v = v.id, cursor, limit);
  };

  public func getSubscriptionFeed(
    videos : Map.Map<Nat, Videos.Video>,
    subscriptions : Map.Map<Common.UserId, Set.Set<Common.UserId>>,
    subscriberId : Common.UserId,
    cursor : Common.Cursor,
    limit : Nat,
  ) : Common.Page<Videos.Video> {
    let channels = switch (subscriptions.get(subscriberId)) {
      case (?s) { s.toArray() };
      case null { [] };
    };
    let published = publishedSorted(videos, false, func v = channels.contains(v.ownerId));
    paginate(published, func v = v.id, cursor, limit);
  };

  public func getChannelVideos(
    videos : Map.Map<Nat, Videos.Video>,
    userId : Common.UserId,
    viewerId : Common.UserId,
    cursor : Common.Cursor,
    limit : Nat,
  ) : Common.Page<Videos.Video> {
    let published = publishedSorted(videos, viewerId == userId, func v = v.ownerId == userId);
    paginate(published, func v = v.id, cursor, limit);
  };
};
