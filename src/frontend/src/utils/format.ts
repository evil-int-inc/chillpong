import type { Timestamp } from "@/types";

/**
 * Convert a Motoko nanosecond timestamp to a Date. Returns null when the
 * value is invalid so callers can render a fallback.
 */
export function timestampToDate(timestamp: Timestamp): Date | null {
  const date = new Date(Number(timestamp / 1_000_000n));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Format a byte count into a human-readable string (e.g. "1.2 GB"). */
export function formatBytes(bytes: number | bigint): string {
  const value = typeof bytes === "bigint" ? Number(bytes) : bytes;
  if (!Number.isFinite(value) || value < 0) return "0 B";
  if (value === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );
  const amount = value / 1024 ** i;
  const formatted =
    amount >= 100 || i === 0
      ? Math.round(amount).toString()
      : amount.toFixed(1);
  return `${formatted} ${units[i]}`;
}

/** Format a duration in seconds as "H:MM:SS" or "MM:SS". */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const seconds = Math.floor(totalSeconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Format a Date as a short localized date (e.g. "Aug 30, 2026"). */
export function formatDate(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Relative time string (e.g. "3 days ago", "just now"). */
export function timeAgo(date: Date | null): string {
  if (!date) return "";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

/** Format a view/subscriber count compactly (e.g. "1.2M"). */
export function formatCount(count: number | bigint): string {
  const value = typeof count === "bigint" ? Number(count) : count;
  if (!Number.isFinite(value)) return "0";
  if (value < 1000) return String(value);
  const units = ["K", "M", "B", "T"];
  const i = Math.min(
    Math.floor(Math.log(value) / Math.log(1000)),
    units.length - 1,
  );
  const amount = value / 1000 ** i;
  const formatted =
    amount >= 100 ? Math.round(amount).toString() : amount.toFixed(1);
  return `${formatted}${units[i]}`;
}
