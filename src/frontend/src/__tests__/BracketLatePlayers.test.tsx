import { BracketGraph } from "@/components/tournaments/BracketGraph";
import type {
  TournamentMatchView,
  TournamentPlayerView,
} from "@/types/tournament-manager";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const players: TournamentPlayerView[] = [
  "Alex",
  "John",
  "Mike",
  "Peter",
  "Maria",
  "David",
  "Giorgi",
  "Sarah",
  "Late Nino",
  "Late Luka",
  "Late Ana",
].map((name, index) => ({
  id: BigInt(index + 1),
  name,
  skill: 2,
  registrationNumber: BigInt(index + 1),
  registeredAt: 0n,
  status: "ready",
  losses: 0,
  manualOverride: false,
}));

function match(
  id: bigint,
  overrides: Partial<TournamentMatchView> = {},
): TournamentMatchView {
  return {
    id,
    bracket: "winners",
    round: 1,
    position: Number(id),
    sourceA: { kind: "player", id: id * 2n - 1n },
    sourceB: { kind: "player", id: id * 2n },
    playerAId: id * 2n - 1n,
    playerBId: id * 2n,
    status: "ready",
    manualOverride: false,
    prioritized: false,
    ...overrides,
  };
}

function generatedDraw(): TournamentMatchView[] {
  return [
    match(1n),
    match(2n),
    match(3n),
    match(4n),
    ...[5n, 6n, 7n].map((id) =>
      match(id, {
        round: id === 7n ? 3 : 2,
        position: id === 6n ? 2 : 1,
        sourceA: { kind: "winner", id: id === 7n ? 5n : id === 5n ? 1n : 3n },
        sourceB: { kind: "winner", id: id === 7n ? 6n : id === 5n ? 2n : 4n },
        playerAId: undefined,
        playerBId: undefined,
        status: "pending",
      }),
    ),
  ];
}

function insertedDraw(): TournamentMatchView[] {
  const matches = generatedDraw();
  matches[0] = match(1n, {
    sourceA: { kind: "winner", id: 9n },
    playerAId: undefined,
    status: "pending",
    manualOverride: true,
  });
  matches[4] = {
    ...matches[4]!,
    sourceA: { kind: "winner", id: 10n },
    manualOverride: true,
  };
  return [
    ...matches,
    match(8n, {
      round: 0,
      position: 1,
      sourceA: { kind: "player", id: 1n },
      sourceB: { kind: "player", id: 9n },
      playerAId: 1n,
      playerBId: 9n,
      manualOverride: true,
    }),
    match(9n, {
      round: 0,
      position: 1,
      sourceA: { kind: "winner", id: 8n },
      sourceB: { kind: "player", id: 10n },
      playerAId: undefined,
      playerBId: 10n,
      status: "pending",
      manualOverride: true,
    }),
    match(10n, {
      round: 1,
      position: 1,
      sourceA: { kind: "winner", id: 1n },
      sourceB: { kind: "player", id: 11n },
      playerAId: undefined,
      playerBId: 11n,
      status: "pending",
      manualOverride: true,
    }),
  ];
}

function cardRectangle(id: bigint) {
  const wrapper = screen.getByTestId(`match.card.${id}`).parentElement!;
  return {
    x: Number.parseFloat(wrapper.style.left),
    y: Number.parseFloat(wrapper.style.top),
    width: Number.parseFloat(wrapper.style.width),
    height: Number.parseFloat(wrapper.style.height),
  };
}

function assertVisibleDraw(matches: TournamentMatchView[]) {
  const bracket = screen.getByRole("region", {
    name: "Complete tournament bracket",
  });
  const canvas = bracket.querySelector<HTMLElement>(".bracket-canvas")!;
  const width = Number.parseFloat(canvas.style.width);
  const height = Number.parseFloat(canvas.style.height);
  const rectangles = matches.map((item) => cardRectangle(item.id));
  expect(within(bracket).getAllByTestId(/^match\.card\./)).toHaveLength(
    matches.length,
  );
  for (const [index, rectangle] of rectangles.entries()) {
    expect(rectangle.x).toBeGreaterThanOrEqual(0);
    expect(rectangle.y).toBeGreaterThanOrEqual(0);
    expect(rectangle.x + rectangle.width).toBeLessThanOrEqual(width);
    expect(rectangle.y + rectangle.height).toBeLessThanOrEqual(height);
    for (const other of rectangles.slice(index + 1)) {
      const separated =
        rectangle.x + rectangle.width <= other.x ||
        other.x + other.width <= rectangle.x ||
        rectangle.y + rectangle.height <= other.y ||
        other.y + other.height <= rectangle.y;
      expect(separated).toBe(true);
    }
  }
  const matchIds = new Set(matches.map((item) => item.id));
  const dependencyCount = matches.reduce(
    (count, item) =>
      count +
      [item.sourceA, item.sourceB].filter(
        (source) =>
          (source.kind === "winner" || source.kind === "loser") &&
          matchIds.has(source.id),
      ).length,
    0,
  );
  expect(bracket.querySelectorAll("svg path[d^='M ']")).toHaveLength(
    dependencyCount,
  );
  return { width, height };
}

describe("late entrants in the full bracket", () => {
  it.each([false, true])(
    "shows every repeated qualifier and late-round entrant with fullscreen=%s",
    (fullscreen) => {
      const matches = insertedDraw();
      render(
        <BracketGraph
          matches={matches}
          players={players}
          onSelect={vi.fn()}
          fullscreen={fullscreen}
        />,
      );
      assertVisibleDraw(matches);
      expect(screen.getByTestId("match.card.8")).toHaveTextContent("Late Nino");
      expect(screen.getByTestId("match.card.9")).toHaveTextContent("Late Luka");
      expect(screen.getByTestId("match.card.9")).toHaveTextContent(
        "Winner / W0.1",
      );
      expect(screen.getByTestId("match.card.10")).toHaveTextContent("Late Ana");
      expect(screen.getByTestId("match.card.10")).toHaveTextContent(
        "Winner / W1.1",
      );
      for (const [parent, child] of [
        [8n, 9n],
        [9n, 1n],
        [1n, 10n],
        [10n, 5n],
        [5n, 7n],
      ]) {
        expect(cardRectangle(child!).x).toBeGreaterThan(
          cardRectangle(parent!).x,
        );
      }
    },
  );

  it("expands the canvas after registration without dropping the existing scored match", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const scored = match(3n, {
      status: "completed",
      scoreA: 11,
      scoreB: 7,
      winnerId: 5n,
    });
    const before = generatedDraw().map((item) =>
      item.id === scored.id ? scored : item,
    );
    const rendered = render(
      <BracketGraph matches={before} players={players} onSelect={onSelect} />,
    );
    const originalSize = assertVisibleDraw(before);
    const after = insertedDraw().map((item) =>
      item.id === scored.id ? scored : item,
    );
    rendered.rerender(
      <BracketGraph matches={after} players={players} onSelect={onSelect} />,
    );
    const updatedSize = assertVisibleDraw(after);
    expect(updatedSize.width).toBeGreaterThan(originalSize.width);
    expect(screen.getByTestId("match.card.3")).toHaveTextContent("11");
    expect(screen.getByTestId("match.card.3")).toHaveTextContent("7");
    await user.click(screen.getByTestId("match.card.10"));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(after.at(-1));
  });

  it("preserves losers and championship dependencies when late qualifiers grow the winners bracket", () => {
    const matches = [
      ...insertedDraw(),
      match(11n, {
        bracket: "losers",
        position: 1,
        sourceA: { kind: "loser", id: 8n },
        sourceB: { kind: "loser", id: 1n },
        playerAId: undefined,
        playerBId: undefined,
        status: "pending",
      }),
      match(12n, {
        bracket: "grandFinal",
        position: 1,
        sourceA: { kind: "winner", id: 7n },
        sourceB: { kind: "winner", id: 11n },
        playerAId: undefined,
        playerBId: undefined,
        status: "pending",
      }),
      match(13n, {
        bracket: "resetFinal",
        position: 1,
        sourceA: { kind: "winner", id: 12n },
        sourceB: { kind: "loser", id: 12n },
        playerAId: undefined,
        playerBId: undefined,
        status: "pending",
      }),
    ];
    render(
      <BracketGraph matches={matches} players={players} onSelect={vi.fn()} />,
    );
    assertVisibleDraw(matches);
    expect(
      screen.getByRole("heading", { name: "Winners bracket" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: /Losers bracket/ }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Grand final" })).toBeVisible();
    expect(screen.getByRole("heading", { name: /Reset final/ })).toBeVisible();
    expect(screen.getByTestId("match.card.11")).toHaveTextContent(
      "Loser / W0.1",
    );
  });

  it("centers a placed match at the current zoom once and then preserves manual navigation", async () => {
    const user = userEvent.setup();
    const matches = insertedDraw();
    const rendered = render(
      <BracketGraph matches={matches} players={players} onSelect={vi.fn()} />,
    );
    const viewport = screen.getByTestId("tournament.bracket");
    Object.defineProperties(viewport, {
      clientWidth: { configurable: true, value: 300 },
      clientHeight: { configurable: true, value: 200 },
    });
    await user.click(screen.getByRole("button", { name: "Zoom bracket in" }));
    rendered.rerender(
      <BracketGraph
        matches={matches}
        players={players}
        onSelect={vi.fn()}
        focusMatchId={10n}
      />,
    );
    const target = cardRectangle(10n);
    await waitFor(() =>
      expect(viewport.scrollLeft).toBeCloseTo(
        (target.x + target.width / 2) * 1.1 - 150,
      ),
    );
    expect(viewport.scrollTop).toBeCloseTo(
      (target.y + target.height / 2) * 1.1 - 100,
    );
    expect(screen.getByLabelText("Bracket zoom")).toHaveTextContent("110%");

    viewport.scrollLeft = 17;
    viewport.scrollTop = 19;
    await user.click(screen.getByRole("button", { name: "Zoom bracket out" }));
    expect(viewport.scrollLeft).toBeLessThan(100);
    expect(viewport.scrollTop).toBeLessThan(100);
    const manualScroll = { left: viewport.scrollLeft, top: viewport.scrollTop };
    rendered.rerender(
      <BracketGraph
        matches={[...matches]}
        players={[...players]}
        onSelect={vi.fn()}
        focusMatchId={10n}
      />,
    );
    expect(viewport.scrollLeft).toBe(manualScroll.left);
    expect(viewport.scrollTop).toBe(manualScroll.top);
  });

  it("waits for an inserted match to exist before consuming its focus request", async () => {
    const rendered = render(
      <BracketGraph
        matches={generatedDraw()}
        players={players}
        onSelect={vi.fn()}
        focusMatchId={10n}
        fullscreen
      />,
    );
    const viewport = screen.getByTestId("tournament.bracket");
    Object.defineProperties(viewport, {
      clientWidth: { configurable: true, value: 280 },
      clientHeight: { configurable: true, value: 160 },
    });
    viewport.scrollLeft = 40;
    viewport.scrollTop = 20;
    rendered.rerender(
      <BracketGraph
        matches={insertedDraw()}
        players={players}
        onSelect={vi.fn()}
        focusMatchId={10n}
        fullscreen
      />,
    );
    const target = cardRectangle(10n);
    await waitFor(() =>
      expect(viewport.scrollLeft).toBeCloseTo(
        target.x + target.width / 2 - 140,
      ),
    );
    expect(viewport.scrollTop).toBeCloseTo(target.y + target.height / 2 - 80);
    expect(screen.getByTestId("match.card.10")).toHaveTextContent("Late Ana");
  });

  it("clamps centering to canvas edges for a viewport larger than the bracket", async () => {
    const matches = insertedDraw();
    const rendered = render(
      <BracketGraph matches={matches} players={players} onSelect={vi.fn()} />,
    );
    const viewport = screen.getByTestId("tournament.bracket");
    Object.defineProperties(viewport, {
      clientWidth: { configurable: true, value: 10_000 },
      clientHeight: { configurable: true, value: 10_000 },
    });
    viewport.scrollLeft = 90;
    viewport.scrollTop = 60;
    rendered.rerender(
      <BracketGraph
        matches={matches}
        players={players}
        onSelect={vi.fn()}
        focusMatchId={8n}
      />,
    );
    await waitFor(() => expect(viewport.scrollLeft).toBe(0));
    expect(viewport.scrollTop).toBe(0);
  });
});
