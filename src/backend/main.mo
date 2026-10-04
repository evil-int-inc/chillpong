import Map "mo:core/Map";
import Array "mo:core/Array";
import Set "mo:core/Set";
import List "mo:core/List";
import Principal "mo:core/Principal";
import AccessControl "mo:caffeineai-authorization/access-control";
import MixinAuthorization "mo:caffeineai-authorization/MixinAuthorization";
import Expose "mo:caffeineai-oql/Expose";
import Entity "mo:caffeineai-oql/Entity";
import MapEntity "mo:caffeineai-oql/MapEntity";
import NatValue "mo:caffeineai-oql/NatValue";
import IntValue "mo:caffeineai-oql/IntValue";
import TextValue "mo:caffeineai-oql/TextValue";
import PrincipalValue "mo:caffeineai-oql/PrincipalValue";
import BoolValue "mo:caffeineai-oql/BoolValue";
import MixinObjectStorage "mo:caffeineai-object-storage/Mixin";
import Common "types/common";
import Users "types/users";
import Videos "types/videos";
import Playlists "types/playlists";
import Notifications "types/notifications";
import Storage "types/storage";
import UsersApi "mixins/users-api";
import VideosApi "mixins/videos-api";
import StorageApi "mixins/storage-api";
import SubscriptionsApi "mixins/subscriptions-api";
import NotificationsApi "mixins/notifications-api";
import FeedApi "mixins/feed-api";
import PlaylistsApi "mixins/playlists-api";
import RolesApi "mixins/roles-api";
import ApiDocMixin "mixins/api-doc";

actor {
  // --- OQL helper functions (variant → text, nested collection → rows) ---

  func uploadKindToText(k : Videos.UploadKind) : Text {
    switch (k) { case (#video) "video"; case (#thumbnail) "thumbnail" };
  };

  func uploadStatusToText(s : Videos.UploadStatus) : Text {
    switch (s) {
      case (#active) "active";
      case (#completed) "completed";
      case (#finalized) "finalized";
      case (#cancelled) "cancelled";
    };
  };

  func notificationKindToText(k : Notifications.NotificationKind) : Text {
    switch (k) {
      case (#newSubscriber(_)) "newSubscriber";
      case (#newVideo(_)) "newVideo";
    };
  };

  func roleToText(r : ?Users.Role) : Text {
    switch (r) {
      case (?#admin) "admin";
      case null "user";
    };
  };

  func flattenSubscriptions(subs : Map.Map<Common.UserId, Set.Set<Common.UserId>>) : [(Common.UserId, Common.UserId)] {
    let acc = List.empty<(Common.UserId, Common.UserId)>();
    for ((subscriber, channels) in subs.entries()) {
      for (channel in channels.toArray().values()) {
        acc.add((subscriber, channel));
      };
    };
    acc.toArray();
  };

  func flattenNotifications(ns : Map.Map<Common.UserId, List.List<Notifications.Notification>>) : [Notifications.Notification] {
    let acc = List.empty<Notifications.Notification>();
    for ((_, list) in ns.entries()) {
      for (n in list.toArray().values()) {
        acc.add(n);
      };
    };
    acc.toArray();
  };

  let accessControlState : AccessControl.AccessControlState;
  let users : Map.Map<Common.UserId, Users.User>;
  let usernames : Map.Map<Text, Common.UserId>;
  let videos : Map.Map<Nat, Videos.Video>;
  let playlists : Map.Map<Nat, Playlists.Playlist>;
  let uploadSessions : Map.Map<Nat, Videos.UploadSession>;
  let counters : Common.Counters;
  let subscriptions : Map.Map<Common.UserId, Set.Set<Common.UserId>>;
  let subscribers : Map.Map<Common.UserId, Set.Set<Common.UserId>>;
  let notifications : Map.Map<Common.UserId, List.List<Notifications.Notification>>;
  let storage : Storage.StorageState;
  let owner : Common.OwnerState;

  include MixinAuthorization(accessControlState, null);
  include MixinObjectStorage();
  include UsersApi(accessControlState, users, usernames);
  include VideosApi(accessControlState, videos, playlists, counters, subscribers, notifications);
  include StorageApi(accessControlState, storage);
  include SubscriptionsApi(accessControlState, subscriptions, subscribers, notifications, counters);
  include NotificationsApi(accessControlState, notifications, counters);
  include FeedApi(accessControlState, videos, subscriptions);
  include PlaylistsApi(accessControlState, playlists, videos, counters);
  include RolesApi(accessControlState, users, owner);
  include ApiDocMixin();

  include Expose({
    entities = [
      users.toEntityManual("user", "User", "id")
        .sample({ id = Principal.fromText("aaaaa-aa"); displayName = ""; username = ""; avatar = null; bio = null; createdAt = 0; role = null })
        .payload("id", func u = u.id)
        .payload("displayName", func u = u.displayName)
        .payload("username", func u = u.username)
        .payload("bio", func u = u.bio ?? "")
        .payload("role", func u = roleToText(u.role))
        .payload("createdAt", func u = u.createdAt)
        .public_()
        .build(),
      videos.toEntityManual("video", "Video", "id")
        .sample({ id = 0; ownerId = Principal.fromText("aaaaa-aa"); title = ""; description = null; video = Array.toBlob([]); thumbnail = null; filename = ""; mimeType = ""; fileSize = 0; viewCount = 0; isPrivate = false; createdAt = 0; publishedAt = null; status = #draft })
        .payload("id", func v = v.id)
        .payload("ownerId", func v = v.ownerId)
        .payload("title", func v = v.title)
        .payload("mimeType", func v = v.mimeType)
        .payload("fileSize", func v = v.fileSize)
        .payload("viewCount", func v = v.viewCount)
        .payload("isPrivate", func v = v.isPrivate)
        .payload("createdAt", func v = v.createdAt)
        .ownedBy("ownerId")
        .scopedPerUser()
        .build(),
      playlists.toEntityManual("playlist", "Playlist", "id")
        .sample({ id = 0; ownerId = Principal.fromText("aaaaa-aa"); title = ""; videoIds = []; isPrivate = false; createdAt = 0; updatedAt = 0 })
        .payload("id", func p = p.id)
        .payload("ownerId", func p = p.ownerId)
        .payload("title", func p = p.title)
        .payload("isPrivate", func p = p.isPrivate)
        .payload("createdAt", func p = p.createdAt)
        .payload("updatedAt", func p = p.updatedAt)
        .ownedBy("ownerId")
        .scopedPerUser()
        .build(),
      uploadSessions.toEntityManual("uploadSession", "UploadSession", "id")
        .sample({ id = 0; ownerId = Principal.fromText("aaaaa-aa"); kind = #video; assetId = ""; mimeType = ""; totalSize = 0; chunkSize = 0; receivedBytes = 0; status = #active; createdAt = 0 })
        .payload("id", func s = s.id)
        .payload("ownerId", func s = s.ownerId)
        .payload("kind", func s = uploadKindToText(s.kind))
        .payload("assetId", func s = s.assetId)
        .payload("mimeType", func s = s.mimeType)
        .payload("totalSize", func s = s.totalSize)
        .payload("receivedBytes", func s = s.receivedBytes)
        .payload("status", func s = uploadStatusToText(s.status))
        .payload("createdAt", func s = s.createdAt)
        .ownedBy("ownerId")
        .scopedPerUser()
        .build(),
      Entity.manual<(Common.UserId, Common.UserId)>("subscription", func () = flattenSubscriptions(subscriptions).values(), "Subscription", "pair")
        .sample((Principal.fromText("aaaaa-aa"), Principal.fromText("aaaaa-aa")))
        .payload("subscriber", func ((s, _)) = s)
        .payload("channel", func ((_, c)) = c)
        .ownedBy("subscriber")
        .scopedPerUser()
        .build(),
      Entity.manual<Notifications.Notification>("notification", func () = flattenNotifications(notifications).values(), "Notification", "id")
        .sample({ id = 0; recipientId = Principal.fromText("aaaaa-aa"); kind = #newSubscriber({ channelId = Principal.fromText("aaaaa-aa") }); createdAt = 0; read = false })
        .payload("id", func n = n.id)
        .payload("recipientId", func n = n.recipientId)
        .payload("kind", func n = notificationKindToText(n.kind))
        .payload("createdAt", func n = n.createdAt)
        .payload("read", func n = n.read)
        .ownedBy("recipientId")
        .scopedPerUser()
        .build(),
    ];
  });
};
