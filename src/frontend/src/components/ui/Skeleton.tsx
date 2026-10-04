import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Renders a circular skeleton (e.g. for avatars). */
  circle?: boolean;
}

export function Skeleton({
  className,
  circle = false,
  ...props
}: SkeletonProps) {
  return (
    <div
      data-ocid="skeleton"
      aria-hidden="true"
      className={cn("skeleton rounded-md", circle && "rounded-full", className)}
      {...props}
    />
  );
}
