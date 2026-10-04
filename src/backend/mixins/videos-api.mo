import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import Map "mo:core/Map";
import List "mo:core/List";
import Set "mo:core/Set";
import AccessControl "mo:caffeineai-authorization/access-control";
import ObjectStorage "mo:caffeineai-object-storage/Storage";
import Common "../types/common";
import Playlists "../types/playlists";
import Videos "../types/videos";
import Notifications "../types/notifications";
import VideosLib "../lib/videos";
import NotificationsLib "../lib/notifications";
import PlaylistsLib "../lib/playlists";

mixin (
  accessControlState : AccessControl.AccessControlState,
  videos : Map.Map<Nat, Videos.Video>,
  playlists : Map.Map<Nat, Playlists.Playlist>,
  counters : Common.Counters,
  subscribers : Map.Map<Common.UserId, Set.Set<Common.UserId>>,
  notifications : Map.Map<Common.UserId, List.List<Notifications.Notification>>,
) {
  public shared ({ caller }) func createVideo(
    title : Text,
    description : ?Text,
    video : ObjectStorage.ExternalBlob,
    thumbnail : ?ObjectStorage.ExternalBlob,
    filename : Text,
    mimeType : Text,
    fileSize : Nat,
    isPrivate : Bool,
    playlist : ?Videos.PlaylistSelection,
  ) : async Videos.CreateVideoResult {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can perform this action");
    };
    if (title == "" or title.size() > 120) {
      Runtime.trap("Title must be between 1 and 120 characters");
    };
    switch (description) {
      case (?value) {
        if (value.size() > 5_000) {
          Runtime.trap("Description exceeds 5000 characters");
        };
      };
      case null {};
    };
    if (filename == "") {
      Runtime.trap("Filename is required");
    };
    if (mimeType != "video/mp4" and mimeType != "video/webm" and mimeType != "video/quicktime") {
      Runtime.trap("Unsupported video format");
    };
    if (fileSize == 0 or fileSize > 1_073_741_824) {
      Runtime.trap("Video must be between 1 byte and 1 GB");
    };
    switch (playlist) {
      case (?#existing(playlistId)) {
        let existing = PlaylistsLib.getPlaylist(playlists, playlistId) ?? Runtime.trap("Playlist not found");
        if (existing.ownerId != caller) {
          Runtime.trap("Playlist not found");
        };
      };
      case (?#new(details)) {
        PlaylistsLib.validateTitle(details.title);
      };
      case null {};
    };

    let now = Time.now();
    let created = VideosLib.createVideo(videos, counters, caller, title, description, video, thumbnail, filename, mimeType, fileSize, isPrivate, now);
    let playlistId = switch (playlist) {
      case (?#existing(id)) {
        ignore PlaylistsLib.addVideo(playlists, id, created.id, now);
        ?id;
      };
      case (?#new(details)) {
        let createdPlaylist = PlaylistsLib.createPlaylist(playlists, counters, caller, details.title, details.isPrivate, [created.id], now);
        ?createdPlaylist.id;
      };
      case null { null };
    };
    { video = created; playlistId };
  };

  public shared ({ caller }) func publishVideo(videoId : Nat) : async Videos.Video {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can perform this action");
    };
    let video = VideosLib.getVideo(videos, videoId) ?? Runtime.trap("Video not found");
    if (video.ownerId != caller) {
      Runtime.trap("Unauthorized: Not the video owner");
    };
    let now = Time.now();
    let published = VideosLib.publishVideo(videos, videoId, now);
    if (not published.isPrivate) {
      switch (subscribers.get(caller)) {
        case (?subSet) {
          for (sub in subSet.toArray().values()) {
            ignore NotificationsLib.createNotification(notifications, counters, sub, #newVideo({ channelId = caller; videoId = videoId }), now);
          };
        };
        case null {};
      };
    };
    published;
  };

  public shared ({ caller }) func deleteVideo(videoId : Nat) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can perform this action");
    };
    let video = VideosLib.getVideo(videos, videoId) ?? Runtime.trap("Video not found");
    if (video.ownerId != caller) {
      Runtime.trap("Unauthorized: Not the video owner");
    };
    let now = Time.now();
    VideosLib.deleteVideo(videos, videoId);
    PlaylistsLib.removeVideoFromAll(playlists, videoId, now);
  };

  public query ({ caller }) func getVideo(videoId : Nat) : async ?Videos.Video {
    switch (VideosLib.getVideo(videos, videoId)) {
      case (?video) {
        if (video.ownerId == caller or (video.status == #published and not video.isPrivate)) {
          ?video;
        } else {
          null;
        };
      };
      case null { null };
    };
  };

  public shared ({ caller }) func recordVideoView(videoId : Nat) : async Nat {
    let video = VideosLib.getVideo(videos, videoId) ?? Runtime.trap("Video not found");
    if (video.status != #published or (video.isPrivate and video.ownerId != caller)) {
      Runtime.trap("Video not available");
    };
    VideosLib.recordView(videos, videoId);
  };

  public query ({ caller }) func getMyVideos(cursor : Common.Cursor, limit : Nat) : async Common.Page<Videos.Video> {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can perform this action");
    };
    VideosLib.getMyVideos(videos, caller, cursor, limit);
  };
};
