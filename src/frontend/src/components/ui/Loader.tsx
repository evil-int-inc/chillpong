import { cn } from "@/lib/utils";

export type LoaderSize = "sm" | "md" | "lg";

export interface LoaderProps {
  size?: LoaderSize;
  label?: string;
  className?: string;
}

const sizeClasses: Record<LoaderSize, string> = {
  sm: "loading-sm",
  md: "loading-md",
  lg: "loading-lg",
};

export function Loader({ size = "md", label, className }: LoaderProps) {
  return (
    <output
      data-ocid="loading_state"
      aria-live="polite"
      className={cn("flex items-center gap-2 text-base-content/60", className)}
    >
      <span
        className={cn(
          "loading loading-spinner text-primary",
          sizeClasses[size],
        )}
        aria-hidden="true"
      />
      {label ? <span className="text-sm">{label}</span> : null}
      <span className="sr-only">Loading</span>
    </output>
  );
}
