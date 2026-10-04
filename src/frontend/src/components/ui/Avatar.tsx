import { cn } from "@/lib/utils";
import { User } from "lucide-react";
import { type HTMLAttributes, forwardRef } from "react";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

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
  xs: "size-6 text-[0.6rem]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-12 text-base",
  xl: "size-16 text-xl",
};

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

    return (
      <span
        ref={ref}
        data-ocid="avatar"
        className={cn(
          "avatar inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-base-300 text-base-content/60 ring-1 ring-base-300",
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {src ? (
          <img
            src={src}
            alt={alt ?? name ?? ""}
            className="size-full object-cover"
          />
        ) : initials ? (
          <span aria-hidden="true" className="font-display font-semibold">
            {initials}
          </span>
        ) : (
          <User className="size-1/2" aria-hidden="true" />
        )}
      </span>
    );
  },
);

Avatar.displayName = "Avatar";
