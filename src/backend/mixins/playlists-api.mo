import Map "mo:core/Map";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import AccessControl "mo:caffeineai-authorization/access-control";
import Common "../types/common";
import Playlists "../types/playlists";
import Videos "../types/videos";
import PlaylistsLib "../lib/playlists";

mixin (
  accessControlState : AccessControl.AccessControlState,
  playlists : Map.Map<Nat, Playlists.Playlist>,
  videos : Map.Map<Nat, Videos.Video>,
  counters : Common.Counters,
) {
  func requireUser(caller : Common.UserId) : () {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can perform this action");
    };
  };

  func requireOwner(caller : Common.UserId, playlistId : Nat) : Playlists.Playlist {
    let playlist = PlaylistsLib.getPlaylist(playlists, playlistId) ?? Runtime.trap("Playlist not found");
    if (playlist.ownerId != caller) {
      Runtime.trap("Playlist not found");
    };
    playlist;
  };

  func requireAddableVideo(caller : Common.UserId, videoId : Nat) : Videos.Video {
    let video = videos.get(videoId) ?? Runtime.trap("Video not found");
    if (not PlaylistsLib.isVideoVisible(video, caller)) {
      Runtime.trap("Video not found");
    };
    video;
  };

  public shared ({ caller }) func createPlaylist(
    title : Text,
    isPrivate : Bool,
    initialVideoId : ?Nat,
  ) : async Playlists.Playlist {
    requireUser(caller);
    let initialVideoIds = switch (initialVideoId) {
      case (?videoId) {
        ignore requireAddableVideo(caller, videoId);
        [videoId];
      };
      case null { [] };
    };
    PlaylistsLib.createPlaylist(playlists, counters, caller, title, isPrivate, initialVideoIds, Time.now());
  };

  public shared ({ caller }) func addVideoToPlaylist(
    playlistId : Nat,
    videoId : Nat,
  ) : async Playlists.Playlist {
    requireUser(caller);
    ignore requireOwner(caller, playlistId);
    ignore requireAddableVideo(caller, videoId);
    PlaylistsLib.addVideo(playlists, playlistId, videoId, Time.now());
  };

  public shared ({ caller }) func removeVideoFromPlaylist(
    playlistId : Nat,
    videoId : Nat,
  ) : async Playlists.Playlist {
    requireUser(caller);
    ignore requireOwner(caller, playlistId);
    PlaylistsLib.removeVideo(playlists, playlistId, videoId, Time.now());
  };

  public query ({ caller }) func getMyPlaylists() : async [Playlists.Playlist] {
    requireUser(caller);
    PlaylistsLib.getMyPlaylists(playlists, caller);
  };

  public query ({ caller }) func getChannelPlaylists(
    userId : Common.UserId,
    cursor : Common.Cursor,
    limit : Nat,
  ) : async Common.Page<Playlists.PlaylistSummary> {
    PlaylistsLib.getChannelPlaylists(playlists, videos, userId, caller, cursor, limit);
  };

  public query ({ caller }) func getPlaylist(playlistId : Nat) : async ?Playlists.PlaylistView {
    switch (PlaylistsLib.getPlaylist(playlists, playlistId)) {
      case (?playlist) {
        if (playlist.isPrivate and playlist.ownerId != caller) {
          null;
        } else {
          ?PlaylistsLib.toView(playlist, videos, caller);
        };
      };
      case null { null };
    };
  };
};
