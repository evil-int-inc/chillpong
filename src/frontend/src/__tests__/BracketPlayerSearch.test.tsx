import { BracketGraph } from "@/components/tournaments/BracketGraph";
import { setLanguage, translate } from "@/i18n";
import {
  type TournamentMatchView,
  type TournamentPlayerView,
  matchLabel,
} from "@/types/tournament-manager";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function player(
  id: bigint,
  name: string,
  overrides: Partial<TournamentPlayerView> = {},
): TournamentPlayerView {
  return {
    id,
    name,
    skill: 2,
    registrationNumber: id,
    registeredAt: 0n,
    status: "ready",
    losses: 0,
    manualOverride: false,
    ...overrides,
  };
}

function match(
  id: bigint,
  overrides: Partial<TournamentMatchView> = {},
): TournamentMatchView {
  return {
    id,
    bracket: "winners",
    round: 1,
    position: Number(id),
    playerAId: 1n,
    playerBId: 2n,
    sourceA: { kind: "player", id: 1n },
    sourceB: { kind: "player", id: 2n },
    status: "ready",
    manualOverride: false,
    prioritized: false,
    ...overrides,
  };
}

const players = [player(1n, "Nino"), player(2n, "Giorgi")];
const next = match(1n);

function renderSearch(
  matches = [next],
  entrants = players,
  options: { fullscreen?: boolean; width?: number; height?: number } = {},
) {
  const onSelect = vi.fn();
  const props = {
    matches,
    players: entrants,
    onSelect,
    fullscreen: options.fullscreen,
  };
  const result = render(<BracketGraph {...props} />);
  const viewport = screen.getByTestId("tournament.bracket");
  const width = options.width ?? 760;
  const height = options.height ?? 500;
  // jsdom has no layout. Set the real dimensions the navigation hook reads;
  // retain its native event handlers and actual React scale/scroll updates.
  Object.defineProperties(viewport, {
    clientWidth: { configurable: true, value: width },
    clientHeight: { configurable: true, value: height },
    getBoundingClientRect: {
      configurable: true,
      value: () => ({ left: 20, top: 30, width, height }),
    },
  });
  return {
    ...result,
    viewport,
    onSelect,
    props,
    input: screen.getByRole("searchbox", {
      name: translate("Find a player in the bracket"),
    }),
    button: screen.getByRole("button", {
      name: translate("Find next match"),
    }),
  };
}

function focusedMatch(id: bigint) {
  return screen.getByTestId(`match.card.${id}`).closest("[data-focused-match]");
}

async function searchName(name: string, keyboard = false) {
  const user = userEvent.setup();
  const input = screen.getByRole("searchbox", {
    name: translate("Find a player in the bracket"),
  });
  await user.clear(input);
  await user.type(input, name);
  if (keyboard) await user.keyboard("{Enter}");
  else
    await user.click(
      screen.getByRole("button", { name: translate("Find next match") }),
    );
}

beforeEach(() => setLanguage("en"));
afterEach(() => {
  act(() => setLanguage("en"));
  vi.unstubAllGlobals();
});

describe("finding a player's next match in the full bracket", () => {
  it.each([false, true])(
    "offers name search in the embedded and full-page graph (fullscreen=%s)",
    async (fullscreen) => {
      const { input, button, onSelect } = renderSearch([next], players, {
        fullscreen,
      });
      expect(input).toBeVisible();
      expect(button).toBeDisabled();
      await searchName("  nInO  ", true);
      expect(focusedMatch(1n)).toHaveAttribute("data-focused-match", "true");
      expect(
        screen.getByText("Showing match W1.1 / M1 for Nino."),
      ).toBeVisible();
      expect(onSelect).not.toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).toBeNull();
    },
  );

  it("keeps empty and whitespace-only submissions disabled", async () => {
    const { input, button } = renderSearch();
    const user = userEvent.setup();
    await user.type(input, "   ");
    expect(button).toBeDisabled();
    await user.keyboard("{Enter}");
    expect(focusedMatch(1n)).toBeNull();
  });

  it("finds a unique partial name with the button and prefers a complete name", async () => {
    const additional = player(3n, "Nino Jr");
    const matches = [next, match(2n, { playerAId: 3n })];
    renderSearch(matches, [...players, additional]);
    await searchName("Nino");
    expect(focusedMatch(1n)).toHaveAttribute("data-focused-match", "true");
    await searchName("Jr");
    expect(focusedMatch(2n)).toHaveAttribute("data-focused-match", "true");
    expect(focusedMatch(1n)).toBeNull();
    expect(
      screen.getByText("Showing match W1.2 / M2 for Nino Jr."),
    ).toBeVisible();
  });

  it.each(["Nino", "Nin"])(
    "asks the user to choose a registration for ambiguous search %s",
    async (query) => {
      const entrants = [
        player(1n, "Nino", { registrationNumber: 12n }),
        player(2n, "NINO", { registrationNumber: 27n }),
        player(3n, "Giorgi"),
      ];
      renderSearch(
        [
          match(1n, { playerBId: 3n }),
          match(2n, { playerAId: 2n, playerBId: 3n }),
        ],
        entrants,
      );
      await searchName(query);
      expect(focusedMatch(1n)).toBeNull();
      expect(focusedMatch(2n)).toBeNull();
      expect(
        screen.getByText("Several players match. Choose a player below."),
      ).toBeVisible();
      const user = userEvent.setup();
      await user.click(
        screen.getByRole("button", {
          name: "Find next match for NINO / #027",
        }),
      );
      expect(focusedMatch(2n)).toHaveAttribute("data-focused-match", "true");
      expect(
        screen.getByText("Showing match W1.2 / M2 for NINO."),
      ).toBeVisible();
    },
  );

  it("reports an unknown name without navigating or opening a match", async () => {
    const { viewport, onSelect } = renderSearch();
    viewport.scrollLeft = 83;
    viewport.scrollTop = 42;
    await searchName("Missing player");
    expect(screen.getByText("No player matches this name.")).toBeVisible();
    expect(viewport.scrollLeft).toBe(83);
    expect(viewport.scrollTop).toBe(42);
    expect(screen.getByLabelText("Bracket zoom")).toHaveTextContent("100%");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it.each(["removed", "eliminated", "champion"] as const)(
    "reports no upcoming match for a %s player despite old participant references",
    async (status) => {
      renderSearch([next], [player(1n, "Nino", { status }), players[1]!]);
      await searchName("Nino");
      expect(screen.getByText("No upcoming match for Nino.")).toBeVisible();
      expect(focusedMatch(1n)).toBeNull();
    },
  );

  it.each(["completed", "bye", "void"] as const)(
    "does not send a player to a %s historical match",
    async (status) => {
      renderSearch([match(1n, { status })]);
      await searchName("Nino");
      expect(screen.getByText("No upcoming match for Nino.")).toBeVisible();
      expect(focusedMatch(1n)).toBeNull();
    },
  );

  it("ignores a historical registration leaf when the player is no longer a participant", async () => {
    renderSearch([
      match(1n, {
        playerAId: undefined,
        playerBId: undefined,
        status: "pending",
      }),
    ]);
    await searchName("Nino");
    expect(screen.getByText("No upcoming match for Nino.")).toBeVisible();
    expect(focusedMatch(1n)).toBeNull();
  });

  it.each([
    { statuses: ["pending", "ready", "playing"], expected: 3n },
    { statuses: ["pending", "ready"], expected: 2n },
    { statuses: ["pending"], expected: 1n },
  ] as const)(
    "finds the next actual participant match in playing, ready, then pending order: $statuses",
    async ({ statuses, expected }) => {
      const matches = statuses.map((status, index) =>
        match(BigInt(index + 1), { status }),
      );
      // A stale currentMatchId may not bypass the next-match status priorities.
      renderSearch(matches, [
        player(1n, "Nino", { currentMatchId: 1n }),
        players[1]!,
      ]);
      await searchName("Nino");
      expect(focusedMatch(expected)).toHaveAttribute(
        "data-focused-match",
        "true",
      );
    },
  );

  it("uses currentMatchId to resolve equally eligible matches", async () => {
    renderSearch(
      [next, match(2n)],
      [player(1n, "Nino", { currentMatchId: 2n }), players[1]!],
    );
    await searchName("Nino");
    expect(focusedMatch(2n)).toHaveAttribute("data-focused-match", "true");
  });

  it("finds a placed entrant while its next opponent is still unresolved", async () => {
    const pending = match(4n, {
      round: 2,
      playerBId: undefined,
      sourceB: { kind: "winner", id: 3n },
      status: "pending",
    });
    renderSearch([pending]);
    await searchName("Nino");
    expect(focusedMatch(4n)).toHaveAttribute("data-focused-match", "true");
    expect(screen.getByText("Showing match W2.4 / M4 for Nino.")).toBeVisible();
  });

  it.each(["Нина", "ნინო"])(
    "searches user names without changing their non-ASCII text: %s",
    async (name) => {
      renderSearch([next], [player(1n, name), players[1]!]);
      await searchName(name.toLowerCase(), true);
      expect(focusedMatch(1n)).toHaveAttribute("data-focused-match", "true");
      expect(
        screen.getByText(`Showing match W1.1 / M1 for ${name}.`),
      ).toBeVisible();
    },
  );
});

function largeDraw() {
  return [
    ...[10n, 11n, 12n, 13n].map((id, index) =>
      match(id, { position: index + 1, playerAId: 8n, playerBId: 9n }),
    ),
    ...[20n, 21n, 22n, 23n].map((id, index) =>
      match(id, {
        round: index + 2,
        position: 1,
        playerAId: id === 22n ? 1n : 8n,
        playerBId: 2n,
        sourceA: { kind: "winner", id: index === 0 ? 10n : id - 1n },
      }),
    ),
  ];
}

describe("zooming to a player's match", () => {
  it("waits for the bracket viewport to become visible before consuming the search", async () => {
    let resized: (() => void) | undefined;
    const disconnect = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          resized = () => callback([], this as unknown as ResizeObserver);
        }
        observe() {}
        disconnect() {
          disconnect();
        }
      },
    );
    const { viewport } = renderSearch(largeDraw(), players, {
      width: 0,
      height: 0,
    });
    await searchName("Nino");
    expect(screen.getByLabelText("Bracket zoom")).toHaveTextContent("100%");
    Object.defineProperties(viewport, {
      clientWidth: { configurable: true, value: 760 },
      clientHeight: { configurable: true, value: 500 },
    });
    act(() => resized?.());
    expect(screen.getByLabelText("Bracket zoom")).toHaveTextContent("140%");
    expect(viewport.scrollLeft).toBeGreaterThan(0);
    expect(viewport.scrollTop).toBeGreaterThan(0);
    expect(disconnect).toHaveBeenCalled();
  });

  it("zooms and centers a match outside the initial viewport without opening it", async () => {
    const { viewport, onSelect } = renderSearch(largeDraw());
    await searchName("Nino");
    expect(screen.getByLabelText("Bracket zoom")).toHaveTextContent("140%");
    const focused = focusedMatch(22n) as HTMLElement;
    expect(focused).toHaveAttribute("data-focused-match", "true");
    const centerX = Number.parseFloat(focused.style.left) + 248 / 2;
    const centerY = Number.parseFloat(focused.style.top) + 148 / 2;
    expect(viewport.scrollLeft + viewport.clientWidth / 2).toBeCloseTo(
      centerX * 1.4,
    );
    expect(viewport.scrollTop + viewport.clientHeight / 2).toBeCloseTo(
      centerY * 1.4,
    );
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("stabilizes the search when zooming adds a scrollbar and narrows the viewport", async () => {
    const { viewport, button } = renderSearch(largeDraw(), players, {
      width: 360,
      height: 670,
    });
    const canvas = viewport.querySelector(".bracket-canvas") as HTMLElement;
    const scale = () => Number.parseFloat(canvas.style.transform.slice(6));
    let widthReads = 0;
    Object.defineProperty(viewport, "clientWidth", {
      configurable: true,
      get: () => {
        // A wider canvas causes a vertical scrollbar. Recomputing the fitted
        // scale from that smaller width would remove it and repeat forever.
        if (++widthReads > 80)
          throw new Error(
            "Bracket search did not stabilize after a scrollbar appeared.",
          );
        return scale() > 1.24 ? 348 : 360;
      },
    });
    await searchName("Nino");
    const firstScale = (360 - 48) / 248;
    expect(scale()).toBeCloseTo(firstScale);
    expect(viewport.clientWidth).toBe(348);
    const focused = focusedMatch(22n) as HTMLElement;
    const centerX = Number.parseFloat(focused.style.left) + 248 / 2;
    const centerY = Number.parseFloat(focused.style.top) + 148 / 2;
    expect(viewport.scrollLeft + viewport.clientWidth / 2).toBeCloseTo(
      centerX * firstScale,
    );
    expect(viewport.scrollTop + viewport.clientHeight / 2).toBeCloseTo(
      centerY * firstScale,
    );

    // A new submission can use the latest size, without oscillating if that
    // lower scale makes the scrollbar disappear again.
    const user = userEvent.setup();
    await user.click(button);
    const secondScale = (348 - 48) / 248;
    expect(scale()).toBeCloseTo(secondScale);
    expect(viewport.clientWidth).toBe(360);
    expect(viewport.scrollLeft + viewport.clientWidth / 2).toBeCloseTo(
      centerX * secondScale,
    );
    expect(viewport.scrollTop + viewport.clientHeight / 2).toBeCloseTo(
      centerY * secondScale,
    );
  });

  it("fits the entire focused card with room around it in a narrow mobile viewport", async () => {
    const { viewport } = renderSearch(largeDraw(), players, {
      width: 280,
      height: 180,
    });
    await searchName("Nino");
    const zoom =
      Number.parseInt(
        screen.getByLabelText("Bracket zoom").textContent ?? "",
        10,
      ) / 100;
    expect(zoom).toBeGreaterThanOrEqual(0.05);
    expect(zoom * 248).toBeLessThanOrEqual(viewport.clientWidth - 46);
    expect(zoom * 148).toBeLessThanOrEqual(viewport.clientHeight - 46);
    const focused = focusedMatch(22n) as HTMLElement;
    const left =
      Number.parseFloat(focused.style.left) * zoom - viewport.scrollLeft;
    const top =
      Number.parseFloat(focused.style.top) * zoom - viewport.scrollTop;
    expect(left).toBeGreaterThanOrEqual(22);
    expect(top).toBeGreaterThanOrEqual(22);
    expect(left + zoom * 248).toBeLessThanOrEqual(viewport.clientWidth - 22);
    expect(top + zoom * 148).toBeLessThanOrEqual(viewport.clientHeight - 22);
  });

  it("allows manual navigation and polling, then refocuses on a repeated submission", async () => {
    const matches = largeDraw();
    const { viewport, rerender, props, input } = renderSearch(matches);
    await searchName("Nino");
    const centeredLeft = viewport.scrollLeft;
    const centeredTop = viewport.scrollTop;
    fireEvent(
      viewport,
      new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        deltaY: 250,
        clientX: 100,
        clientY: 100,
      }),
    );
    expect(screen.getByLabelText("Bracket zoom")).not.toHaveTextContent("140%");
    viewport.scrollLeft = 53;
    viewport.scrollTop = 74;
    rerender(
      <BracketGraph
        {...props}
        matches={matches.map((item) => ({ ...item }))}
        players={players.map((item) => ({ ...item }))}
      />,
    );
    expect(viewport.scrollLeft).toBe(53);
    expect(viewport.scrollTop).toBe(74);
    const user = userEvent.setup();
    await user.click(input);
    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(screen.getByLabelText("Bracket zoom")).toHaveTextContent("140%"),
    );
    expect(viewport.scrollLeft).toBeCloseTo(centeredLeft);
    expect(viewport.scrollTop).toBeCloseTo(centeredTop);
  });

  it("localizes search feedback after a language change without recentering the user's view", async () => {
    const { viewport } = renderSearch(largeDraw());
    await searchName("Nino");
    viewport.scrollLeft = 91;
    viewport.scrollTop = 72;
    act(() => setLanguage("ru"));
    expect(
      screen.getByRole("searchbox", {
        name: translate("Find a player in the bracket"),
      }),
    ).toBeVisible();
    expect(
      screen.getByText(
        translate("Showing match {match} for {name}.", {
          match: `${matchLabel(largeDraw().find((item) => item.id === 22n)!)} / M22`,
          name: "Nino",
        }),
      ),
    ).toBeVisible();
    expect(viewport.scrollLeft).toBe(91);
    expect(viewport.scrollTop).toBe(72);
  });
});
