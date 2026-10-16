import { cn } from "@/lib/utils";
import { User } from "lucide-react";
import { type HTMLAttributes, forwardRef, useState } from "react";

export type AvatarSize = "xxs" | "xs" | "sm" | "md" | "lg" | "xl";

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  /** URL of the user's avatar image. When omitted, initials or a fallback icon render. */
  src?: string;
  /** Alt text for the avatar image. */
  alt?: string;
  /** Display name used to derive initials when no image is provided. */
  name?: string;
  size?: AvatarSize;
}

const sizeClasses: Record<AvatarSize, string> = {
  xxs: "size-4 text-[0.5rem]",
  xs: "size-6 text-[0.6rem]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-12 text-base",
  xl: "size-16 text-xl",
};

export interface AvatarUser {
  displayName?: string;
  username?: string;
  avatarUrl?: string;
  avatar?: { getDirectURL(): string };
}

export interface UserAvatarProps extends AvatarProps {
  user?: AvatarUser | null;
}

function imageSource(src?: string): string | undefined {
  if (!src?.trim()) return undefined;
  try {
    const url = new URL(src, window.location.href);
    if (
      url.protocol === "https:" ||
      url.protocol === "blob:" ||
      (url.protocol === "http:" && url.origin === window.location.origin)
    ) {
      return url.href;
    }
  } catch {
    // Invalid or unsupported URLs render the same fallback as missing photos.
  }
  return undefined;
}

function initialsOf(name?: string): string {
  if (!name) return "";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(
  ({ className, src, alt, name, size = "md", ...props }, ref) => {
    const initials = initialsOf(name);
    const image = imageSource(src);
    const [failedImage, setFailedImage] = useState<string>();
    const showImage = !!image && image !== failedImage;
    const label = alt ?? name ?? "";

    return (
      <span
        ref={ref}
        data-ocid="avatar"
        role={!showImage && label ? "img" : undefined}
        aria-label={!showImage && label ? label : undefined}
        aria-hidden={label ? undefined : true}
        className={cn(
          "avatar inline-flex shrink-0 text-base-content/60",
          !showImage && "avatar-placeholder",
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        <span className="flex aspect-square size-full items-center justify-center overflow-hidden rounded-full bg-base-300 ring-1 ring-base-300">
          {showImage ? (
            <img
              key={image}
              src={image}
              alt={label}
              className="size-full object-cover"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setFailedImage(image)}
            />
          ) : initials ? (
            <span aria-hidden="true" className="font-display font-semibold">
              {initials}
            </span>
          ) : (
            <User className="size-1/2" aria-hidden="true" />
          )}
        </span>
      </span>
    );
  },
);

Avatar.displayName = "Avatar";

export const UserAvatar = forwardRef<HTMLSpanElement, UserAvatarProps>(
  ({ user, name, src, ...props }, ref) => (
    <Avatar
      ref={ref}
      {...props}
      name={name ?? (user?.displayName || user?.username)}
      src={src ?? user?.avatarUrl ?? user?.avatar?.getDirectURL()}
    />
  ),
);

UserAvatar.displayName = "UserAvatar";
