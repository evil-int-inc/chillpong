import {
  type MouseEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export const MIN_BRACKET_ZOOM = 0.05;
export const MAX_BRACKET_ZOOM = 1.6;
const DRAG_THRESHOLD = 4;
const WHEEL_ZOOM_SPEED = 0.0015;

interface Point {
  x: number;
  y: number;
}

interface ScrollPosition {
  left: number;
  top: number;
}

interface Pan extends Point, ScrollPosition {
  pointerId: number;
  pointerType: string;
  lastX: number;
  lastY: number;
  dragging: boolean;
}

interface Pinch {
  ids: [number, number];
  distance: number;
  zoom: number;
  content: Point;
}

function clampZoom(value: number) {
  return Math.max(MIN_BRACKET_ZOOM, Math.min(MAX_BRACKET_ZOOM, value));
}

/** Scroll coordinates remain in screen pixels while the canvas is scaled. */
export function useBracketNavigation(enabled: boolean) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const zoomRef = useRef(1);
  const renderedZoomRef = useRef(1);
  const pendingScrollRef = useRef<ScrollPosition | null>(null);
  const panRef = useRef<Pan | null>(null);
  const touchesRef = useRef(new Map<number, Point>());
  const pinchRef = useRef<Pinch | null>(null);
  const suppressClickRef = useRef(false);

  const scrollPosition = useCallback((): ScrollPosition => {
    const viewport = viewportRef.current;
    return (
      pendingScrollRef.current ?? {
        left: viewport?.scrollLeft ?? 0,
        top: viewport?.scrollTop ?? 0,
      }
    );
  }, []);

  const localPoint = useCallback((point: Point): Point => {
    const viewport = viewportRef.current;
    if (!viewport) return point;
    const bounds = viewport.getBoundingClientRect();
    return {
      x: point.x - bounds.left - viewport.clientLeft,
      y: point.y - bounds.top - viewport.clientTop,
    };
  }, []);

  const commitScroll = useCallback((position: ScrollPosition) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollLeft = position.left;
    viewport.scrollTop = position.top;
    // A wheel event can arrive while a mouse drag is held. Rebase its origin
    // after scaling so the next movement continues without a jump.
    const pan = panRef.current;
    if (pan) {
      pan.x = pan.lastX;
      pan.y = pan.lastY;
      pan.left = viewport.scrollLeft;
      pan.top = viewport.scrollTop;
    }
  }, []);

  const transform = useCallback(
    (nextZoom: number, position: ScrollPosition) => {
      zoomRef.current = nextZoom;
      if (nextZoom === renderedZoomRef.current) {
        pendingScrollRef.current = null;
        commitScroll(position);
      } else {
        // Apply the anchor after React grows/shrinks the scrollable canvas;
        // applying it earlier lets the browser clamp to the old dimensions.
        pendingScrollRef.current = position;
      }
      setZoom(nextZoom);
    },
    [commitScroll],
  );

  useLayoutEffect(() => {
    renderedZoomRef.current = zoom;
    const position = pendingScrollRef.current;
    if (position) {
      pendingScrollRef.current = null;
      commitScroll(position);
    }
  }, [zoom, commitScroll]);

  const zoomTo = useCallback(
    (value: number, anchor?: Point) => {
      const viewport = viewportRef.current;
      if (!viewport || !Number.isFinite(value)) return;
      const nextZoom = clampZoom(value);
      if (nextZoom === zoomRef.current) return;
      const point = anchor ?? {
        x: viewport.clientWidth / 2,
        y: viewport.clientHeight / 2,
      };
      const scroll = scrollPosition();
      const ratio = nextZoom / zoomRef.current;
      transform(nextZoom, {
        left: (scroll.left + point.x) * ratio - point.x,
        top: (scroll.top + point.y) * ratio - point.y,
      });
    },
    [scrollPosition, transform],
  );

  const fitZoom = useCallback(
    (value: number) => {
      if (Number.isFinite(value))
        transform(clampZoom(value), { left: 0, top: 0 });
    },
    [transform],
  );

  const capture = useCallback((pointerId: number) => {
    viewportRef.current?.setPointerCapture?.(pointerId);
  }, []);

  const release = useCallback((pointerId: number) => {
    const viewport = viewportRef.current;
    if (viewport?.hasPointerCapture?.(pointerId))
      viewport.releasePointerCapture?.(pointerId);
  }, []);

  const startPan = useCallback(
    (
      pointerId: number,
      pointerType: string,
      point: Point,
      dragging = false,
    ) => {
      panRef.current = {
        pointerId,
        pointerType,
        ...point,
        ...scrollPosition(),
        lastX: point.x,
        lastY: point.y,
        dragging,
      };
      setIsPanning(dragging);
    },
    [scrollPosition],
  );

  const startPinch = useCallback(() => {
    const entries = [...touchesRef.current.entries()];
    if (entries.length < 2) return;
    const [[firstId, first], [secondId, second]] = entries;
    const midpoint = localPoint({
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2,
    });
    const scroll = scrollPosition();
    pinchRef.current = {
      ids: [firstId, secondId],
      distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
      zoom: zoomRef.current,
      content: {
        x: (scroll.left + midpoint.x) / zoomRef.current,
        y: (scroll.top + midpoint.y) / zoomRef.current,
      },
    };
    panRef.current = null;
    suppressClickRef.current = true;
    setIsPanning(true);
    for (const [id] of entries) capture(id);
  }, [capture, localPoint, scrollPosition]);

  const endPointer = useCallback(
    (pointerId: number) => {
      if (touchesRef.current.delete(pointerId)) {
        const wasPinching = pinchRef.current !== null;
        pinchRef.current = null;
        panRef.current = null;
        release(pointerId);
        if (touchesRef.current.size >= 2) {
          startPinch();
        } else if (touchesRef.current.size === 1) {
          const [[id, point]] = touchesRef.current;
          // Continue from the remaining finger's current position rather than
          // its pre-pinch position. A canceled finger behaves the same way.
          startPan(id, "touch", point, wasPinching);
        } else {
          setIsPanning(false);
        }
        return;
      }
      const pan = panRef.current;
      if (!pan || pan.pointerId !== pointerId) return;
      panRef.current = null;
      setIsPanning(false);
      release(pointerId);
    },
    [release, startPan, startPinch],
  );

  useEffect(() => {
    const endAll = () => {
      const ids = [...touchesRef.current.keys()];
      if (panRef.current) ids.push(panRef.current.pointerId);
      touchesRef.current.clear();
      pinchRef.current = null;
      panRef.current = null;
      setIsPanning(false);
      for (const id of ids) release(id);
    };
    const handleEnd = (event: globalThis.PointerEvent) =>
      endPointer(event.pointerId);
    window.addEventListener("blur", endAll);
    // A tap or a pre-threshold mouse movement has no pointer capture yet.
    // Release outside the viewport must still clear that gesture.
    window.addEventListener("pointerup", handleEnd);
    window.addEventListener("pointercancel", handleEnd);
    return () => {
      window.removeEventListener("blur", endAll);
      window.removeEventListener("pointerup", handleEnd);
      window.removeEventListener("pointercancel", handleEnd);
    };
  }, [endPointer, release]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!enabled || !viewport) return;
    const wheel = (event: WheelEvent) => {
      // Touch scrolling uses pointer events. Ignore any synthetic wheel events
      // emitted by a touch device while a finger gesture is in progress.
      if (touchesRef.current.size) return;
      const source = (
        event as WheelEvent & {
          sourceCapabilities?: { firesTouchEvents?: boolean };
        }
      ).sourceCapabilities;
      if (source?.firesTouchEvents) return;
      const delta = event.deltaY || event.deltaX;
      if (!delta || !Number.isFinite(delta)) return;
      event.preventDefault();
      const unit =
        event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? viewport.clientHeight
            : 1;
      const pixels = Math.max(-1000, Math.min(1000, delta * unit));
      zoomTo(
        zoomRef.current * Math.exp(-pixels * WHEEL_ZOOM_SPEED),
        localPoint({ x: event.clientX, y: event.clientY }),
      );
    };
    // React wheel handlers are passive; a native non-passive listener is
    // required to replace desktop scrolling only inside the bracket viewport.
    viewport.addEventListener("wheel", wheel, { passive: false });
    return () => viewport.removeEventListener("wheel", wheel);
  }, [enabled, localPoint, zoomTo]);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const point = { x: event.clientX, y: event.clientY };
      if (event.pointerType === "touch") {
        if (panRef.current?.pointerType === "mouse")
          endPointer(panRef.current.pointerId);
        if (!touchesRef.current.size) suppressClickRef.current = false;
        touchesRef.current.set(event.pointerId, point);
        if (touchesRef.current.size === 1) {
          startPan(event.pointerId, "touch", point);
        } else {
          event.preventDefault();
          startPinch();
        }
        return;
      }
      if (
        event.pointerType !== "mouse" ||
        event.button !== 0 ||
        !event.isPrimary ||
        touchesRef.current.size
      )
        return;
      suppressClickRef.current = false;
      startPan(event.pointerId, "mouse", point);
    },
    [endPointer, startPan, startPinch],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (touchesRef.current.has(event.pointerId)) {
        touchesRef.current.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
        });
        const pinch = pinchRef.current;
        if (pinch) {
          const first = touchesRef.current.get(pinch.ids[0]);
          const second = touchesRef.current.get(pinch.ids[1]);
          if (!first || !second) return;
          event.preventDefault();
          const nextZoom = clampZoom(
            (pinch.zoom * Math.hypot(second.x - first.x, second.y - first.y)) /
              pinch.distance,
          );
          const midpoint = localPoint({
            x: (first.x + second.x) / 2,
            y: (first.y + second.y) / 2,
          });
          transform(nextZoom, {
            left: pinch.content.x * nextZoom - midpoint.x,
            top: pinch.content.y * nextZoom - midpoint.y,
          });
          return;
        }
      }
      const pan = panRef.current;
      if (!pan || pan.pointerId !== event.pointerId) return;
      if (pan.pointerType === "mouse" && !(event.buttons & 1)) {
        endPointer(event.pointerId);
        return;
      }
      pan.lastX = event.clientX;
      pan.lastY = event.clientY;
      const dx = event.clientX - pan.x;
      const dy = event.clientY - pan.y;
      if (!pan.dragging) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        pan.dragging = true;
        suppressClickRef.current = true;
        capture(event.pointerId);
        setIsPanning(true);
      }
      event.preventDefault();
      const viewport = viewportRef.current;
      if (viewport) {
        viewport.scrollLeft = pan.left - dx;
        viewport.scrollTop = pan.top - dy;
      }
    },
    [capture, endPointer, localPoint, transform],
  );

  const onClickCapture = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (suppressClickRef.current && event.detail > 0) {
      event.preventDefault();
      event.stopPropagation();
      suppressClickRef.current = false;
    }
  }, []);

  return {
    viewportRef,
    zoom,
    isPanning,
    zoomTo,
    fitZoom,
    onPointerDown,
    onPointerMove,
    onPointerUp: (event: PointerEvent<HTMLDivElement>) =>
      endPointer(event.pointerId),
    onPointerCancel: (event: PointerEvent<HTMLDivElement>) =>
      endPointer(event.pointerId),
    onLostPointerCapture: (event: PointerEvent<HTMLDivElement>) => {
      // Moving implicit touch capture from a card to the viewport also emits
      // this event on the card; only lost viewport capture ends navigation.
      if (event.target === event.currentTarget) endPointer(event.pointerId);
    },
    onClickCapture,
  };
}
