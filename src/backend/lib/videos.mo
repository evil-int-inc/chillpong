import Runtime "mo:core/Runtime";
import Int "mo:core/Int";
import Map "mo:core/Map";
import Common "../types/common";
import Videos "../types/videos";
import FeedLib "../lib/feed";

module {
  public func createVideo(
    videos : Map.Map<Nat, Videos.Video>,
    counters : Common.Counters,
    ownerId : Common.UserId,
    title : Text,
    description : ?Text,
    videoBlob : Blob,
    thumbnailBlob : ?Blob,
    filename : Text,
    mimeType : Text,
    fileSize : Nat,
    isPrivate : Bool,
    now : Common.Timestamp,
  ) : Videos.Video {
    let id = counters.nextVideoId;
    counters.nextVideoId += 1;
    let video : Videos.Video = {
      id;
      ownerId;
      title;
      description;
      video = videoBlob;
      thumbnail = thumbnailBlob;
      filename;
      mimeType;
      fileSize;
      viewCount = 0;
      isPrivate;
      createdAt = now;
      publishedAt = null;
      status = #draft;
    };
    videos.add(id, video);
    video;
  };

  public func publishVideo(videos : Map.Map<Nat, Videos.Video>, videoId : Nat, now : Common.Timestamp) : Videos.Video {
    let video = videos.get(videoId) ?? Runtime.trap("Video not found");
    let updated = { video with status = #published; publishedAt = ?now };
    videos.add(videoId, updated);
    updated;
  };

  public func deleteVideo(videos : Map.Map<Nat, Videos.Video>, videoId : Nat) : () {
    let video = videos.get(videoId) ?? Runtime.trap("Video not found");
    let updated = { video with status = #deleted };
    videos.add(videoId, updated);
  };

  public func getVideo(videos : Map.Map<Nat, Videos.Video>, videoId : Nat) : ?Videos.Video {
    videos.get(videoId);
  };

  public func recordView(videos : Map.Map<Nat, Videos.Video>, videoId : Nat) : Nat {
    let video = videos.get(videoId) ?? Runtime.trap("Video not found");
    let updated = { video with viewCount = video.viewCount + 1 };
    videos.add(videoId, updated);
    updated.viewCount;
  };

  public func getMyVideos(
    videos : Map.Map<Nat, Videos.Video>,
    ownerId : Common.UserId,
    cursor : Common.Cursor,
    limit : Nat,
  ) : Common.Page<Videos.Video> {
    let mine = videos.entries()
      .toArray()
      .filter(func (_, v) = v.ownerId == ownerId)
      .map(func (_, v) = v)
      .sort(func (a, b) = Int.compare(b.id, a.id));
    FeedLib.paginate(mine, func v = v.id, cursor, limit);
  };
};
