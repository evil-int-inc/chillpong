import { Button } from "@/components/ui/Button";
import { useSubscription } from "@/hooks/useSubscription";
import { formatCount } from "@/utils/format";
import { Principal } from "@icp-sdk/core/principal";
import { Bell, BellOff } from "lucide-react";

interface SubscribeButtonProps {
  /** The channel (user) being subscribed to. */
  channelId: string;
  /** When true, the button is hidden entirely (e.g. viewing your own channel). */
  hidden?: boolean;
  /** When true, the button is disabled (e.g. not signed in). */
  disabled?: boolean;
}

/**
 * Subscribe / unsubscribe toggle for a channel. Shows the current subscriber
 * count and switches between a subscribe and subscribed state. Hidden when
 * viewing your own channel.
 */
export function SubscribeButton({
  channelId,
  hidden = false,
  disabled = false,
}: SubscribeButtonProps) {
  const { isSubscribed, subscriberCount, isPending, subscribe, unsubscribe } =
    useSubscription(Principal.fromText(channelId));

  if (hidden) return null;

  const subscribed = isSubscribed ?? false;
  const count =
    subscriberCount !== undefined ? formatCount(subscriberCount) : null;

  const label = subscribed ? "Subscribed" : "Subscribe";

  return (
    <div className="flex items-center gap-3">
      <Button
        variant={subscribed ? "outline" : "primary"}
        size="md"
        loading={isPending}
        disabled={disabled}
        onClick={() => {
          if (subscribed) {
            unsubscribe();
          } else {
            subscribe();
          }
        }}
        data-ocid={subscribed ? "unsubscribe_button" : "subscribe_button"}
        aria-pressed={subscribed}
      >
        {subscribed ? (
          <BellOff className="size-4" aria-hidden="true" />
        ) : (
          <Bell className="size-4" aria-hidden="true" />
        )}
        {label}
      </Button>

      {count !== null ? (
        <span
          data-ocid="subscriber_count"
          className="text-sm text-muted-foreground"
        >
          {count} subscriber{Number(subscriberCount) === 1 ? "" : "s"}
        </span>
      ) : null}
    </div>
  );
}
