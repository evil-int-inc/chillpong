import { routeTree } from "@/App";
import {
  type Tournament,
  TournamentBracket,
  TournamentElimination,
  TournamentFormat,
  TournamentMatchStatus,
  TournamentPlayerStatus,
  type TournamentState,
  TournamentStatus,
  TournamentTableStatus,
} from "@/backend";
import { setLanguage } from "@/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createMemoryHistory,
  createRouter,
} from "@tanstack/react-router";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  isFetching: false,
  actor: {
    getTournament: vi.fn(),
    getTournamentState: vi.fn(),
    getTournaments: vi.fn(),
    applyTournamentCommand: vi.fn(),
  },
}));

vi.mock("@caffeineai/core-infrastructure", () => ({
  useActor: () => ({ actor: state.actor, isFetching: state.isFetching }),
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    isAdmin: false,
    isAuthenticated: false,
    isInitializing: false,
    isLoggingIn: false,
    profile: null,
    principal: null,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

const now = BigInt(Date.parse("2026-10-10T14:00:00Z")) * 1_000_000n;
const tournament: Tournament = {
  id: 0n,
  title: "Warehouse Cup",
  description: "Bring your paddle",
  venue: "ChillPong Bar",
  startsAt: now,
  format: TournamentFormat.singles,
  capacity: 2n,
  status: TournamentStatus.live,
  createdAt: now,
  updatedAt: now,
};
const room: TournamentState = {
  tournamentId: 0n,
  elimination: TournamentElimination.singleElimination,
  tableCount: 1n,
  started: true,
  players: ["Nika", "Mariam"].map((name, index) => ({
    id: BigInt(index + 1),
    name,
    skillLevel: 2n,
    registrationNumber: BigInt(index + 1),
    registeredAt: now,
    status: TournamentPlayerStatus.ready,
    currentMatchId: 1n,
    losses: 0n,
  })),
  matches: [
    {
      id: 1n,
      bracket: TournamentBracket.winners,
      round: 1n,
      position: 1n,
      sourceA: { __kind__: "player", player: 1n },
      sourceB: { __kind__: "player", player: 2n },
      playerA: 1n,
      playerB: 2n,
      status: TournamentMatchStatus.ready,
      priority: 0n,
      manualOverride: false,
    },
  ],
  waitingQueue: [1n, 2n],
  nextMatches: [1n],
  tables: [{ number: 1n, status: TournamentTableStatus.available }],
  history: [],
  canUndo: false,
  updatedAt: now,
};

function renderRoute(url = "/tournaments/0?view=bracket") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...result, router };
}

function expectFullPageLayout() {
  expect(screen.getByTestId("tournament.fullscreen_view")).toBeVisible();
  expect(screen.queryByTestId("header")).toBeNull();
  expect(screen.queryByTestId("sidebar")).toBeNull();
  expect(
    screen.queryByRole("link", { name: "Built with caffeine.ai ↗" }),
  ).toBeNull();
}

beforeEach(() => {
  setLanguage("en");
  state.isFetching = false;
  for (const method of Object.values(state.actor)) method.mockReset();
  state.actor.getTournament.mockResolvedValue(tournament);
  state.actor.getTournamentState.mockResolvedValue(room);
  state.actor.getTournaments.mockResolvedValue([tournament]);
});

describe("full-page tournament bracket routing", () => {
  it("opens a shared URL directly with the title and bracket, without the app chrome or player list", async () => {
    const { router } = renderRoute();
    await screen.findByRole("heading", { name: "Warehouse Cup" });

    expectFullPageLayout();
    expect(
      screen.getByRole("region", { name: "Complete tournament bracket" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Close fullscreen bracket" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Copy bracket link" }),
    ).toBeVisible();
    expect(screen.queryByTestId("tournament.players_table")).toBeNull();
    expect(router.state.location.search).toEqual({ view: "bracket" });
    expect(state.actor.getTournament).toHaveBeenCalledWith(0n);
    expect(state.actor.applyTournamentCommand).not.toHaveBeenCalled();
  });

  it("exits to the extended room and restores fullscreen on browser back and forward", async () => {
    const user = userEvent.setup();
    const { router } = renderRoute();
    await screen.findByRole("heading", { name: "Warehouse Cup" });
    await user.click(
      screen.getByRole("button", { name: "Close fullscreen bracket" }),
    );

    await waitFor(() =>
      expect(screen.queryByTestId("tournament.fullscreen_view")).toBeNull(),
    );
    expect(router.state.location.pathname).toBe("/tournaments/0");
    expect(router.state.location.search).not.toHaveProperty("view");
    expect(screen.getByTestId("header")).toBeVisible();
    expect(screen.getByTestId("sidebar")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Extended view" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("region", { name: "Complete tournament bracket" }),
    ).toBeVisible();

    await act(async () => {
      router.history.back();
    });
    await waitFor(expectFullPageLayout);
    await act(async () => {
      router.history.forward();
    });
    await waitFor(() =>
      expect(screen.queryByTestId("tournament.fullscreen_view")).toBeNull(),
    );
    expect(
      screen.getByRole("button", { name: "Extended view" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("enters fullscreen from the normal room and keeps the same mode when the shared URL is loaded again", async () => {
    const user = userEvent.setup();
    const first = renderRoute("/tournaments/0");
    await screen.findByRole("heading", { name: "Warehouse Cup" });
    expect(
      screen.getByRole("button", { name: "Standard view" }),
    ).toHaveAttribute("aria-pressed", "true");
    await user.click(
      screen.getByRole("button", { name: "Open fullscreen bracket" }),
    );
    await waitFor(expectFullPageLayout);
    expect(first.router.state.location.search).toEqual({ view: "bracket" });

    const sharedUrl = first.router.state.location.href;
    first.unmount();
    renderRoute(sharedUrl);
    await screen.findByRole("heading", { name: "Warehouse Cup" });
    expectFullPageLayout();
  });

  it("keeps the fullscreen close control available before the draw is generated", async () => {
    state.actor.getTournamentState.mockResolvedValue({
      ...room,
      started: false,
      matches: [],
      nextMatches: [],
    });
    const user = userEvent.setup();
    renderRoute();
    await screen.findByRole("heading", { name: "Warehouse Cup" });
    expectFullPageLayout();
    expect(screen.queryByTestId("match.card.1")).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Close fullscreen bracket" }),
    );
    await waitFor(() =>
      expect(screen.queryByTestId("tournament.fullscreen_view")).toBeNull(),
    );
    expect(screen.getByTestId("header")).toBeVisible();
  });

  it.each(["loading", "error", "missing"] as const)(
    "lets visitors exit fullscreen from the %s state",
    async (condition) => {
      if (condition === "loading") state.isFetching = true;
      if (condition === "error")
        state.actor.getTournamentState.mockRejectedValue(new Error("Offline"));
      if (condition === "missing")
        state.actor.getTournamentState.mockResolvedValue(undefined);
      const user = userEvent.setup();
      const { router } = renderRoute();
      const close = await screen.findByRole("button", {
        name: "Close fullscreen bracket",
      });
      expectFullPageLayout();
      if (condition === "error")
        await screen.findByRole("heading", {
          name: "The match desk is offline.",
        });
      if (condition === "missing")
        await screen.findByRole("heading", { name: "Tournament not found." });
      await user.click(close);
      await waitFor(() => expect(screen.getByTestId("header")).toBeVisible());
      expect(router.state.location.search).not.toHaveProperty("view");
    },
  );

  it("closes a match dialog before Escape exits fullscreen", async () => {
    const user = userEvent.setup();
    const { router } = renderRoute();
    await screen.findByRole("heading", { name: "Warehouse Cup" });
    await user.click(screen.getByTestId("match.card.1"));
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText(/Results and assignments are managed/),
    ).toBeVisible();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expectFullPageLayout();
    expect(router.state.location.search).toEqual({ view: "bracket" });
    // Native browsers cancel a modal on Escape; jsdom needs that event explicitly.
    fireEvent(dialog, new Event("cancel", { bubbles: true, cancelable: true }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expectFullPageLayout();
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByTestId("tournament.fullscreen_view")).toBeNull(),
    );
    expect(router.state.location.search).not.toHaveProperty("view");
  });

  it.each([
    "/tournaments?view=bracket",
    "/tournaments/no-such-id?view=bracket",
    "/tournaments/0?view=anything",
  ])("keeps the normal app layout for %s", async (url) => {
    renderRoute(url);
    await screen.findByTestId("header");
    expect(screen.getByTestId("sidebar")).toBeVisible();
    expect(screen.queryByTestId("tournament.fullscreen_view")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Close fullscreen bracket" }),
    ).toBeNull();
  });
});
