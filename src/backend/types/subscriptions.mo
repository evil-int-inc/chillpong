import Common "../types/common";

module {
  public type Subscription = {
    subscriberId : Common.UserId;
    channelId : Common.UserId;
    createdAt : Common.Timestamp;
  };
};
