import Common "../types/common";

module {
  public type NotificationKind = {
    #newSubscriber : { channelId : Common.UserId };
    #newVideo : { channelId : Common.UserId; videoId : Nat };
  };

  public type Notification = {
    id : Nat;
    recipientId : Common.UserId;
    kind : NotificationKind;
    createdAt : Common.Timestamp;
    read : Bool;
  };
};
