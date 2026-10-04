import { cn } from "@/lib/utils";

export interface ProgressProps {
  /** Progress value between 0 and 100. */
  value: number;
  /** Optional label shown above the bar (e.g. "Uploading 45%"). */
  label?: string;
  className?: string;
}

export function Progress({ value, label, className }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className={cn("w-full", className)}>
      {label ? (
        <div className="mb-1.5 flex items-center justify-between text-sm">
          <span className="text-base-content/60">{label}</span>
          <span className="font-mono text-base-content">
            {Math.round(clamped)}%
          </span>
        </div>
      ) : null}
      <progress
        data-ocid="progress"
        className="progress progress-primary h-2 w-full"
        value={clamped}
        max={100}
      />
    </div>
  );
}
