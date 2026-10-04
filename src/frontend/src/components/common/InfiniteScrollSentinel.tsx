import { useEffect, useRef } from "react";

interface InfiniteScrollSentinelProps {
  /** Called when the sentinel becomes visible in the viewport. */
  onIntersect: () => void;
  /** When true, the observer is disconnected and no callbacks fire. */
  disabled?: boolean;
  /** IntersectionObserver rootMargin — how early to trigger before reaching it. */
  rootMargin?: string;
}

/**
 * A zero-height sentinel that reports when it scrolls into view, used to
 * drive infinite-scroll pagination. Keeps the latest callback in a ref so the
 * observer is not torn down and recreated on every render.
 */
export function InfiniteScrollSentinel({
  onIntersect,
  disabled = false,
  rootMargin = "200px",
}: InfiniteScrollSentinelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onIntersectRef = useRef(onIntersect);
  onIntersectRef.current = onIntersect;

  useEffect(() => {
    const node = ref.current;
    if (!node || disabled) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onIntersectRef.current();
        }
      },
      { rootMargin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [disabled, rootMargin]);

  return (
    <div
      ref={ref}
      data-ocid="infinite_scroll_sentinel"
      aria-hidden="true"
      className="h-px w-full"
    />
  );
}
