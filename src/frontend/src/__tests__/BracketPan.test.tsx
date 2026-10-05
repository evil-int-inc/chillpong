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

function renderBracket() {
  const onSelect = vi.fn();
  render(
    <BracketGraph matches={[match]} players={players} onSelect={onSelect} />,
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
    { pointerType: "touch" },
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
