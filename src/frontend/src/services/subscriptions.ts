import type { Backend } from "@/backend";
import type { UserId } from "@/types";

/** Backend operations for channel subscriptions. */
export class SubscriptionService {
  /** Subscribes the caller to a channel. */
  subscribe(actor: Backend, channelId: UserId): Promise<void> {
    return actor.subscribe(channelId);
  }

  /** Unsubscribes the caller from a channel. */
  unsubscribe(actor: Backend, channelId: UserId): Promise<void> {
    return actor.unsubscribe(channelId);
  }

  /** Returns whether the caller is subscribed to a channel. */
  isSubscribed(actor: Backend, channelId: UserId): Promise<boolean> {
    return actor.isSubscribed(channelId);
  }

  /** Returns the ids of channels the caller is subscribed to. */
  getSubscribedChannels(actor: Backend): Promise<Array<UserId>> {
    return actor.getSubscribedChannels();
  }

  /** Returns the subscriber count of a channel. */
  getSubscriberCount(actor: Backend, channelId: UserId): Promise<bigint> {
    return actor.getSubscriberCount(channelId);
  }
}

export const subscriptionService = new SubscriptionService();
