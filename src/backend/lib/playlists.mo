import Array "mo:core/Array";
import Char "mo:core/Char";
import Int "mo:core/Int";
import List "mo:core/List";
import Map "mo:core/Map";
import Runtime "mo:core/Runtime";
import Common "../types/common";
import Playlists "../types/playlists";
import Videos "../types/videos";
import FeedLib "../lib/feed";

module {
  public let maxTitleLength : Nat = 100;
  public let maxPlaylistsPerUser : Nat = 100;
  public let maxVideosPerPlaylist : Nat = 200;

  public func normalizeTitle(title : Text) : Text {
    let normalized = title.trim(#predicate(Char.isWhitespace));
    if (normalized == "" or normalized.size() > maxTitleLength) {
      Runtime.trap("Playlist title must be between 1 and 100 characters");
    };
    normalized;
  };

  public func validateTitle(title : Text) : () {
    ignore normalizeTitle(title);
  };

  public func getPlaylist(
    playlists : Map.Map<Nat, Playlists.Playlist>,
    playlistId : Nat,
  ) : ?Playlists.Playlist {
    playlists.get(playlistId);
  };

  func ownsTooManyPlaylists(
    playlists : Map.Map<Nat, Playlists.Playlist>,
    ownerId : Common.UserId,
  ) : Bool {
    var count = 0;
    for ((_, playlist) in playlists.entries()) {
      if (playlist.ownerId == ownerId) {
        count += 1;
      };
    };
    count >= maxPlaylistsPerUser;
  };

  public func createPlaylist(
    playlists : Map.Map<Nat, Playlists.Playlist>,
    counters : Common.Counters,
    ownerId : Common.UserId,
    title : Text,
    isPrivate : Bool,
    initialVideoIds : [Nat],
    now : Common.Timestamp,
  ) : Playlists.Playlist {
    let normalizedTitle = normalizeTitle(title);
    if (ownsTooManyPlaylists(playlists, ownerId)) {
      Runtime.trap("Playlist limit reached");
    };
    if (initialVideoIds.size() > maxVideosPerPlaylist) {
      Runtime.trap("Playlist video limit reached");
    };

    let id = counters.nextPlaylistId;
    counters.nextPlaylistId += 1;
    let playlist : Playlists.Playlist = {
      id;
      ownerId;
      title = normalizedTitle;
      videoIds = initialVideoIds;
      isPrivate;
      createdAt = now;
      updatedAt = now;
    };
    playlists.add(id, playlist);
    playlist;
  };

  public func addVideo(
    playlists : Map.Map<Nat, Playlists.Playlist>,
    playlistId : Nat,
    videoId : Nat,
    now : Common.Timestamp,
  ) : Playlists.Playlist {
    let playlist = playlists.get(playlistId) ?? Runtime.trap("Playlist not found");
    if (playlist.videoIds.contains(videoId)) {
      return playlist;
    };
    if (playlist.videoIds.size() >= maxVideosPerPlaylist) {
      Runtime.trap("Playlist video limit reached");
    };
    let updated = {
      playlist with
      videoIds = playlist.videoIds.concat([videoId]);
      updatedAt = now;
    };
    playlists.add(playlistId, updated);
    updated;
  };

  public func removeVideo(
    playlists : Map.Map<Nat, Playlists.Playlist>,
    playlistId : Nat,
    videoId : Nat,
    now : Common.Timestamp,
  ) : Playlists.Playlist {
    let playlist = playlists.get(playlistId) ?? Runtime.trap("Playlist not found");
    let videoIds = playlist.videoIds.filter(func id = id != videoId);
    if (videoIds.size() == playlist.videoIds.size()) {
      return playlist;
    };
    let updated = { playlist with videoIds; updatedAt = now };
    playlists.add(playlistId, updated);
    updated;
  };

  public func removeVideoFromAll(
    playlists : Map.Map<Nat, Playlists.Playlist>,
    videoId : Nat,
    now : Common.Timestamp,
  ) : () {
    for ((playlistId, playlist) in playlists.entries()) {
      if (playlist.videoIds.contains(videoId)) {
        let videoIds = playlist.videoIds.filter(func id = id != videoId);
        playlists.add(playlistId, {
          playlist with
          videoIds;
          updatedAt = now;
        });
      };
    };
  };

  public func isVideoVisible(video : Videos.Video, viewerId : Common.UserId) : Bool {
    video.status == #published and (not video.isPrivate or video.ownerId == viewerId);
  };

  public func visibleVideos(
    playlist : Playlists.Playlist,
    videos : Map.Map<Nat, Videos.Video>,
    viewerId : Common.UserId,
  ) : [Videos.Video] {
    let visible = List.empty<Videos.Video>();
    for (videoId in playlist.videoIds.values()) {
      switch (videos.get(videoId)) {
        case (?video) {
          if (isVideoVisible(video, viewerId)) {
            visible.add(video);
          };
        };
        case null {};
      };
    };
    visible.toArray();
  };

  public func toSummary(
    playlist : Playlists.Playlist,
    visible : [Videos.Video],
  ) : Playlists.PlaylistSummary {
    let firstVideo = if (visible.size() == 0) { null } else { ?visible[0] };
    {
      id = playlist.id;
      ownerId = playlist.ownerId;
      title = playlist.title;
      videoCount = visible.size();
      thumbnail = switch (firstVideo) {
        case (?video) { video.thumbnail };
        case null { null };
      };
      firstVideoId = switch (firstVideo) {
        case (?video) { ?video.id };
        case null { null };
      };
      isPrivate = playlist.isPrivate;
      createdAt = playlist.createdAt;
      updatedAt = playlist.updatedAt;
    };
  };

  public func toView(
    playlist : Playlists.Playlist,
    videos : Map.Map<Nat, Videos.Video>,
    viewerId : Common.UserId,
  ) : Playlists.PlaylistView {
    let visible = visibleVideos(playlist, videos, viewerId);
    { playlist = toSummary(playlist, visible); videos = visible };
  };

  public func getMyPlaylists(
    playlists : Map.Map<Nat, Playlists.Playlist>,
    ownerId : Common.UserId,
  ) : [Playlists.Playlist] {
    playlists.entries()
      .toArray()
      .filter(func (_, playlist) = playlist.ownerId == ownerId)
      .map(func (_, playlist) = playlist)
      .sort(func (a, b) = Int.compare(b.id, a.id));
  };

  public func getChannelPlaylists(
    playlists : Map.Map<Nat, Playlists.Playlist>,
    videos : Map.Map<Nat, Videos.Video>,
    userId : Common.UserId,
    viewerId : Common.UserId,
    cursor : Common.Cursor,
    limit : Nat,
  ) : Common.Page<Playlists.PlaylistSummary> {
    let summaries = playlists.entries()
      .toArray()
      .filter(func (_, playlist) = playlist.ownerId == userId and (viewerId == userId or not playlist.isPrivate))
      .map(func (_, playlist) {
        let visible = visibleVideos(playlist, videos, viewerId);
        toSummary(playlist, visible);
      })
      .filter(func summary = viewerId == userId or summary.videoCount > 0)
      .sort(func (a, b) = Int.compare(b.id, a.id));
    FeedLib.paginate(summaries, func playlist = playlist.id, cursor, limit);
  };
};
