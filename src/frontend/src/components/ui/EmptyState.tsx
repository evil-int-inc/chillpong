import { cn } from "@/lib/utils";
import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      data-ocid="empty_state"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-box border border-dashed border-base-300 bg-base-100 px-6 py-14 text-center",
        className,
      )}
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-base-300 text-base-content/60">
        {icon ?? <Inbox className="size-7" aria-hidden="true" />}
      </div>
      <h3 className="font-display text-lg font-semibold text-base-content">
        {title}
      </h3>
      {description ? (
        <p className="max-w-sm text-sm text-base-content/60">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
