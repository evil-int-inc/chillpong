import type { UserId } from "@/backend";
import { type AvatarSize, UserAvatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";

export function PlayerIdentity({
  player,
  size = "xs",
  className,
  nameClassName,
}: {
  player: { name: string; userId?: UserId; avatarUrl?: string };
  size?: AvatarSize;
  className?: string;
  nameClassName?: string;
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      {player.userId || player.avatarUrl ? (
        <UserAvatar
          user={{ avatarUrl: player.avatarUrl }}
          name={player.name}
          size={size}
          alt=""
          aria-hidden="true"
        />
      ) : null}
      <span className={cn("min-w-0", nameClassName)}>{player.name}</span>
    </span>
  );
}
