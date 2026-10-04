import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  action?: ReactNode;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  retryLabel = "Try again",
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      data-ocid="error_state"
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-box border border-error/30 bg-base-100 px-6 py-14 text-center",
        className,
      )}
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-error/10 text-error">
        <AlertTriangle className="size-7" aria-hidden="true" />
      </div>
      <h3 className="font-display text-lg font-semibold text-base-content">
        {title}
      </h3>
      {message ? (
        <p className="max-w-sm text-sm text-base-content/60">{message}</p>
      ) : null}
      {action ? (
        <div className="mt-2">{action}</div>
      ) : onRetry ? (
        <button
          type="button"
          data-ocid="retry_button"
          className="btn btn-primary btn-sm mt-2"
          onClick={onRetry}
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
