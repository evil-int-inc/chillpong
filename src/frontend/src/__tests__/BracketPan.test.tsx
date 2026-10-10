import { BracketGraph } from "@/components/tournaments/BracketGraph";
import type {
  TournamentMatchView,
  TournamentPlayerView,
} from "@/types/tournament-manager";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const match: TournamentMatchView = {
  id: 1n,
  bracket: "winners",
  round: 1,
  position: 1,
  playerAId: 1n,
  playerBId: 2n,
  sourceA: { kind: "player", id: 1n },
  sourceB: { kind: "player", id: 2n },
  status: "ready",
  manualOverride: false,
  prioritized: false,
};
const players: TournamentPlayerView[] = ["Nino", "Giorgi"].map(
  (name, index) => ({
    id: BigInt(index + 1),
    name,
    skill: 2,
    registrationNumber: BigInt(index + 1),
    registeredAt: 0n,
    status: "ready",
    losses: 0,
    manualOverride: false,
  }),
);

function renderBracket(fullscreen = false) {
  const onSelect = vi.fn();
  render(
    <BracketGraph
      matches={[match]}
      players={players}
      onSelect={onSelect}
      fullscreen={fullscreen}
    />,
  );
  const viewport = screen.getByTestId("tournament.bracket");
  const captured = new Set<number>();
  // jsdom has no layout or pointer capture. Supply a scrollable viewport and
  // capture bookkeeping; the component still handles real bubbling events.
  Object.defineProperties(viewport, {
    clientWidth: { configurable: true, value: 300 },
    clientHeight: { configurable: true, value: 200 },
    scrollWidth: { configurable: true, value: 1200 },
    scrollHeight: { configurable: true, value: 1000 },
    setPointerCapture: {
      configurable: true,
      value: (id: number) => captured.add(id),
    },
    hasPointerCapture: {
      configurable: true,
      value: (id: number) => captured.has(id),
    },
    releasePointerCapture: {
      configurable: true,
      value: (id: number) => captured.delete(id),
    },
    getBoundingClientRect: {
      configurable: true,
      value: () => ({ left: 20, top: 30, width: 300, height: 200 }),
    },
  });
  viewport.scrollLeft = 100;
  viewport.scrollTop = 80;
  return {
    viewport,
    card: screen.getByTestId("match.card.1"),
    onSelect,
    captured,
  };
}

interface PointerOptions extends MouseEventInit {
  pointerId?: number;
  pointerType?: string;
  isPrimary?: boolean;
}

function pointer(
  target: HTMLElement,
  type: string,
  options: PointerOptions = {},
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    buttons: 1,
    clientX: 100,
    clientY: 100,
    ...options,
  });
  // PointerEvent is missing in jsdom, so enrich a mouse event with the native
  // pointer fields React's pointer handlers consume.
  Object.defineProperties(event, {
    pointerId: { value: options.pointerId ?? 1 },
    pointerType: { value: options.pointerType ?? "mouse" },
    isPrimary: { value: options.isPrimary ?? true },
  });
  fireEvent(target, event);
  return event;
}

describe("full bracket drag navigation", () => {
  it("pans both axes opposite the mouse movement from the initial scroll position", () => {
    const { viewport, captured } = renderBracket();
    pointer(viewport, "pointerdown");
    pointer(viewport, "pointermove", { clientX: 70, clientY: 50 });

    expect(viewport.scrollLeft).toBe(130);
    expect(viewport.scrollTop).toBe(130);
    expect(viewport).toHaveAttribute("data-panning", "true");
    expect(captured.has(1)).toBe(true);

    pointer(viewport, "pointermove", { clientX: 80, clientY: 60 });
    expect(viewport.scrollLeft).toBe(120);
    expect(viewport.scrollTop).toBe(120);

    pointer(viewport, "pointerup", { buttons: 0 });
    expect(viewport).not.toHaveAttribute("data-panning", "true");
    expect(captured.has(1)).toBe(false);
  });

  it.each([
    [0, 0],
    [2, 1],
  ])("keeps match clicks with only %ipx / %ipx movement", (dx, dy) => {
    const { viewport, card, onSelect } = renderBracket();
    pointer(card, "pointerdown");
    pointer(viewport, "pointermove", {
      clientX: 100 + dx,
      clientY: 100 + dy,
    });
    expect(viewport.scrollLeft).toBe(100);
    expect(viewport.scrollTop).toBe(80);
    expect(viewport).not.toHaveAttribute("data-panning", "true");

    pointer(card, "pointerup", { buttons: 0 });
    fireEvent.click(card, { detail: 1 });
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(match);
  });

  it("starts dragging at four pixels and prevents a dragged match from opening", async () => {
    const user = userEvent.setup();
    const { viewport, card, onSelect } = renderBracket();
    pointer(card, "pointerdown");
    pointer(viewport, "pointermove", { clientX: 104 });
    expect(viewport.scrollLeft).toBe(96);
    expect(viewport).toHaveAttribute("data-panning", "true");

    pointer(viewport, "pointerup", { buttons: 0 });
    fireEvent.click(card, { detail: 1 });
    expect(onSelect).not.toHaveBeenCalled();

    card.focus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(match);

    pointer(card, "pointerdown");
    pointer(card, "pointerup", { buttons: 0 });
    fireEvent.click(card, { detail: 1 });
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it.each(["pointerup", "pointercancel", "lostpointercapture"])(
    "ends panning after %s and allows a fresh drag",
    (endEvent) => {
      const { viewport } = renderBracket();
      pointer(viewport, "pointerdown");
      pointer(viewport, "pointermove", { clientX: 70, clientY: 60 });
      pointer(viewport, endEvent, { buttons: 0 });
      pointer(viewport, "pointermove", { clientX: 50, clientY: 40 });

      expect(viewport.scrollLeft).toBe(130);
      expect(viewport.scrollTop).toBe(120);
      expect(viewport).not.toHaveAttribute("data-panning", "true");

      pointer(viewport, "pointerdown", { clientX: 50, clientY: 40 });
      pointer(viewport, "pointermove", { clientX: 40, clientY: 30 });
      expect(viewport.scrollLeft).toBe(140);
      expect(viewport.scrollTop).toBe(130);
    },
  );

  it.each(["blur", "released button"])(
    "stops a drag when the mouse release is missed: %s",
    (reason) => {
      const { viewport, captured } = renderBracket();
      pointer(viewport, "pointerdown");
      pointer(viewport, "pointermove", { clientX: 70, clientY: 60 });
      if (reason === "blur") {
        fireEvent(window, new Event("blur"));
      } else {
        pointer(viewport, "pointermove", {
          buttons: 0,
          clientX: 50,
          clientY: 40,
        });
      }
      pointer(viewport, "pointermove", { clientX: 50, clientY: 40 });

      expect(viewport.scrollLeft).toBe(130);
      expect(viewport.scrollTop).toBe(120);
      expect(viewport).not.toHaveAttribute("data-panning", "true");
      expect(captured.size).toBe(0);
    },
  );

  it.each([
    { pointerType: "mouse", button: 2, buttons: 2 },
    { pointerType: "pen" },
    { isPrimary: false },
  ])(
    "preserves native interaction for an unsupported pointer: %j",
    (options) => {
      const { viewport, captured } = renderBracket();
      const down = pointer(viewport, "pointerdown", options);
      const move = pointer(viewport, "pointermove", {
        ...options,
        clientX: 60,
        clientY: 60,
      });

      expect(down.defaultPrevented).toBe(false);
      expect(move.defaultPrevented).toBe(false);
      expect(viewport.scrollLeft).toBe(100);
      expect(viewport.scrollTop).toBe(80);
      expect(viewport).not.toHaveAttribute("data-panning", "true");
      expect(captured.size).toBe(0);
    },
  );

  it("ignores movement and termination from a different pointer", () => {
    const { viewport } = renderBracket();
    pointer(viewport, "pointerdown");
    pointer(viewport, "pointermove", { pointerId: 2, clientX: 60 });
    expect(viewport.scrollLeft).toBe(100);

    pointer(viewport, "pointermove", { clientX: 70 });
    pointer(viewport, "pointerup", { pointerId: 2, buttons: 0 });
    pointer(viewport, "pointermove", { clientX: 60 });
    expect(viewport.scrollLeft).toBe(140);
    expect(viewport).toHaveAttribute("data-panning", "true");
  });
});

function wheel(target: HTMLElement, options: WheelEventInit) {
  const event = new WheelEvent("wheel", {
    bubbles: true,
    cancelable: true,
    clientX: 120,
    clientY: 130,
    ...options,
  });
  fireEvent(target, event);
  return event;
}

function touch(
  target: HTMLElement,
  type: string,
  id: number,
  x: number,
  y = 130,
) {
  return pointer(target, type, {
    pointerType: "touch",
    pointerId: id,
    isPrimary: id === 1,
    clientX: x,
    clientY: y,
    buttons: type === "pointerup" ? 0 : 1,
  });
}

describe("full bracket zoom navigation", () => {
  it("replaces wheel scrolling with zoom anchored at the pointer, in both directions", () => {
    const { viewport } = renderBracket();
    const delta = Math.log(1.5) / 0.0015;
    const zoomIn = wheel(viewport, { deltaY: -delta });
    expect(zoomIn.defaultPrevented).toBe(true);
    expect(screen.getByLabelText("Bracket zoom")).toHaveTextContent("150%");
    // Local cursor (100, 100) stays over the same content point: (200, 180).
    expect(viewport.scrollLeft).toBeCloseTo(200);
    expect(viewport.scrollTop).toBeCloseTo(170);

    const zoomOut = wheel(viewport, { deltaY: delta });
    expect(zoomOut.defaultPrevented).toBe(true);
    expect(screen.getByLabelText("Bracket zoom")).toHaveTextContent("100%");
    expect(viewport.scrollLeft).toBeCloseTo(100);
    expect(viewport.scrollTop).toBeCloseTo(80);
  });

  it.each([
    { deltaMode: 0, deltaY: -160 },
    { deltaMode: 1, deltaY: -10 },
    { deltaMode: 2, deltaY: -0.8 },
  ])("normalizes wheel pixel, line, and page units: %j", (options) => {
    const { viewport } = renderBracket();
    wheel(viewport, options);
    expect(screen.getByLabelText("Bracket zoom")).toHaveTextContent("127%");
  });

  it("clamps zoom to 5–160% and leaves wheel events outside the viewport alone", () => {
    const { viewport } = renderBracket();
    for (let index = 0; index < 3; index++) wheel(viewport, { deltaY: 100000 });
    expect(screen.getByLabelText("Bracket zoom")).toHaveTextContent("5%");
    expect(
      screen.getByRole("button", { name: "Zoom bracket out" }),
    ).toBeDisabled();
    for (let index = 0; index < 3; index++)
      wheel(viewport, { deltaY: -100000 });
    expect(screen.getByLabelText("Bracket zoom")).toHaveTextContent("160%");
    expect(
      screen.getByRole("button", { name: "Zoom bracket in" }),
    ).toBeDisabled();

    const outside = wheel(screen.getByRole("button", { name: "Fit bracket" }), {
      deltaY: 100,
    });
    expect(outside.defaultPrevented).toBe(false);
    expect(screen.getByLabelText("Bracket zoom")).toHaveTextContent("160%");
  });

  it("keeps toolbar zoom centered, fit at the origin, and reset centered", () => {
    const { viewport } = renderBracket();
    fireEvent.click(screen.getByRole("button", { name: "Zoom bracket in" }));
    expect(screen.getByLabelText("Bracket zoom")).toHaveTextContent("110%");
    expect(viewport.scrollLeft).toBeCloseTo(125);
    expect(viewport.scrollTop).toBeCloseTo(98);

    fireEvent.click(screen.getByRole("button", { name: "Reset bracket zoom" }));
    expect(screen.getByLabelText("Bracket zoom")).toHaveTextContent("100%");
    expect(viewport.scrollLeft).toBeCloseTo(100);
    expect(viewport.scrollTop).toBeCloseTo(80);

    fireEvent.click(screen.getByRole("button", { name: "Fit bracket" }));
    expect(viewport.scrollLeft).toBe(0);
    expect(viewport.scrollTop).toBe(0);
    expect(screen.getByLabelText("Bracket zoom")).toHaveTextContent("56%");
  });

  it("continues a mouse drag from the scaled position when a wheel event arrives mid-drag", () => {
    const { viewport } = renderBracket();
    pointer(viewport, "pointerdown");
    pointer(viewport, "pointermove", { clientX: 70, clientY: 70 });
    wheel(viewport, { deltaY: -Math.log(1.5) / 0.0015 });
    expect(viewport.scrollLeft).toBeCloseTo(245);
    expect(viewport.scrollTop).toBeCloseTo(215);
    pointer(viewport, "pointermove", { clientX: 60, clientY: 60 });
    expect(viewport.scrollLeft).toBeCloseTo(255);
    expect(viewport.scrollTop).toBeCloseTo(225);
  });

  it("fills the available height only in the page-wide view", () => {
    const { viewport } = renderBracket(true);
    expect(viewport).toHaveClass("flex-1", "min-h-0");
    expect(viewport).not.toHaveClass("max-h-[75vh]");
    expect(
      screen.getByRole("region", { name: "Complete tournament bracket" }),
    ).toHaveClass("flex", "flex-col", "flex-1");
  });
});

describe("full bracket touch navigation", () => {
  it("keeps taps clickable and pans with one finger after the drag threshold", () => {
    const { viewport, card, captured, onSelect } = renderBracket();
    const down = touch(card, "pointerdown", 1, 120);
    touch(card, "pointermove", 1, 122);
    touch(card, "pointerup", 1, 122);
    fireEvent.click(card, { detail: 1 });
    expect(down.defaultPrevented).toBe(false);
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(match);
    expect(captured.size).toBe(0);

    touch(card, "pointerdown", 1, 120);
    const move = touch(viewport, "pointermove", 1, 90, 90);
    expect(move.defaultPrevented).toBe(true);
    expect(viewport.scrollLeft).toBe(130);
    expect(viewport.scrollTop).toBe(120);
    expect(captured.has(1)).toBe(true);
    // Moving a browser's implicit card capture to the viewport must not end pan.
    touch(card, "lostpointercapture", 1, 90, 90);
    expect(viewport).toHaveAttribute("data-panning", "true");
    touch(viewport, "pointerup", 1, 90, 90);
    fireEvent.click(card, { detail: 1 });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("pinches in and out around the moving midpoint and suppresses match clicks", () => {
    const { viewport, card, captured, onSelect } = renderBracket();
    touch(card, "pointerdown", 1, 70);
    const secondDown = touch(card, "pointerdown", 2, 170);
    expect(secondDown.defaultPrevented).toBe(true);
    expect(captured.size).toBe(2);

    const spread = touch(viewport, "pointermove", 2, 220);
    expect(spread.defaultPrevented).toBe(true);
    expect(screen.getByLabelText("Bracket zoom")).toHaveTextContent("150%");
    expect(viewport.scrollLeft).toBeCloseTo(175);
    expect(viewport.scrollTop).toBeCloseTo(170);

    touch(viewport, "pointermove", 2, 120);
    expect(screen.getByLabelText("Bracket zoom")).toHaveTextContent("50%");
    expect(viewport.scrollLeft).toBeCloseTo(25);
    expect(viewport.scrollTop).toBeCloseTo(-10);

    touch(viewport, "pointerup", 2, 120);
    touch(viewport, "pointerup", 1, 70);
    fireEvent.click(card, { detail: 1 });
    expect(onSelect).not.toHaveBeenCalled();
    expect(captured.size).toBe(0);
    expect(viewport).not.toHaveAttribute("data-panning", "true");

    touch(card, "pointerdown", 1, 120);
    touch(card, "pointerup", 1, 120);
    fireEvent.click(card, { detail: 1 });
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(match);
  });

  it.each(["pointerup", "pointercancel", "lostpointercapture"])(
    "continues one-finger panning without jumps after pinch %s",
    (endEvent) => {
      const { viewport } = renderBracket();
      touch(viewport, "pointerdown", 1, 70);
      touch(viewport, "pointerdown", 2, 170);
      touch(viewport, "pointermove", 2, 220);
      touch(viewport, endEvent, 2, 220);
      const left = viewport.scrollLeft;
      const top = viewport.scrollTop;
      touch(viewport, "pointermove", 1, 60, 120);
      expect(viewport.scrollLeft).toBeCloseTo(left + 10);
      expect(viewport.scrollTop).toBeCloseTo(top + 10);
      touch(viewport, "pointerup", 1, 60, 120);
      expect(viewport).not.toHaveAttribute("data-panning", "true");
    },
  );

  it("clears pinch state on blur and ignores touch-generated wheel events", () => {
    const { viewport, captured } = renderBracket();
    touch(viewport, "pointerdown", 1, 70);
    touch(viewport, "pointerdown", 2, 170);
    const scroll = wheel(viewport, { deltaY: -100 });
    expect(scroll.defaultPrevented).toBe(false);
    expect(screen.getByLabelText("Bracket zoom")).toHaveTextContent("100%");
    fireEvent(window, new Event("blur"));
    touch(viewport, "pointermove", 2, 250);
    expect(captured.size).toBe(0);
    expect(viewport).not.toHaveAttribute("data-panning", "true");
    expect(screen.getByLabelText("Bracket zoom")).toHaveTextContent("100%");

    touch(viewport, "pointerdown", 1, 70);
    touch(viewport, "pointermove", 1, 60);
    expect(viewport.scrollLeft).toBe(110);
  });

  it("clamps pinch zoom and rebases a replacement second finger", () => {
    const { viewport } = renderBracket();
    touch(viewport, "pointerdown", 1, 70);
    touch(viewport, "pointerdown", 2, 170);
    touch(viewport, "pointermove", 2, 570);
    expect(screen.getByLabelText("Bracket zoom")).toHaveTextContent("160%");
    touch(viewport, "pointermove", 2, 71);
    expect(screen.getByLabelText("Bracket zoom")).toHaveTextContent("5%");
    touch(viewport, "pointerup", 2, 71);
    touch(viewport, "pointerdown", 3, 170);
    touch(viewport, "pointermove", 3, 270);
    expect(screen.getByLabelText("Bracket zoom")).toHaveTextContent("10%");
  });
});
