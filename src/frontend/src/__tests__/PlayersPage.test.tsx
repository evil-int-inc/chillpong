import { type Tournament, TournamentFormat, TournamentStatus } from "@/backend";
import { PlayersPage } from "@/pages/PlayersPage";
import type {
  TournamentManagerView,
  TournamentMatchView,
  TournamentPlayerView,
} from "@/types/tournament-manager";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  auth: { isAdmin: false },
  actor: { getTournaments: vi.fn() },
  manager: { get: vi.fn(), apply: vi.fn() },
}));
vi.mock("@caffeineai/core-infrastructure", () => ({
  useActor: () => ({ actor: state.actor, isFetching: false }),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => state.auth }));
vi.mock("@/services/tournament-manager", () => ({
  tournamentManagerService: state.manager,
}));
const registeredAt = BigInt(Date.parse("2026-10-10T16:00:00Z")) * 1_000_000n;

function tournament(id: bigint, status = TournamentStatus.live): Tournament {
  return {
    id,
    title: id === 2n ? "Night Rally" : "Next Night",
    description: "Weekly rally",
    venue: "ChillPong Bar",
    startsAt: registeredAt,
    format: TournamentFormat.singles,
    capacity: 16n,
    status,
    createdAt: registeredAt,
    updatedAt: registeredAt,
  };
}
function player(
  id: bigint,
  name: string,
  skill: number,
  status: TournamentPlayerView["status"],
  extra: Partial<TournamentPlayerView> = {},
): TournamentPlayerView {
  return {
    id,
    name,
    skill,
    status,
    registrationNumber: id,
    registeredAt: registeredAt + id * 60_000_000_000n,
    losses: 0,
    manualOverride: false,
    ...extra,
  };
}
function match(
  id: bigint,
  playerAId: bigint,
  extra: Partial<TournamentMatchView> = {},
): TournamentMatchView {
  return {
    id,
    bracket: "winners",
    round: 1,
    position: Number(id),
    playerAId,
    sourceA: { kind: "player", id: playerAId },
    sourceB: { kind: "bye" },
    status: "pending",
    manualOverride: false,
    prioritized: false,
    ...extra,
  };
}
function lineup(id = 2n): TournamentManagerView {
  return {
    tournament: tournament(id),
    elimination: "double",
    tableCount: 3,
    started: true,
    generated: true,
    complete: false,
    canChangeFormat: false,
    canUndo: false,
    undoCount: 0,
    history: [],
    nextMatches: [2n],
    waitingQueue: [2n, 3n, 5n],
    players: [
      player(1n, "Zara", 2, "playing", { currentMatchId: 1n, table: 1 }),
      player(2n, "Alex", 1, "ready", { currentMatchId: 2n, table: 2 }),
      player(3n, "Nino", 2, "advanced"),
      player(4n, "Ana", 4, "eliminated", { losses: 2 }),
      player(5n, "Beka", 2, "waiting"),
      player(6n, "Giorgi", 5, "removed"),
    ],
    matches: [
      match(1n, 1n, { status: "playing", table: 1 }),
      match(2n, 2n, { bracket: "losers", status: "ready", table: 2 }),
      match(3n, 3n, { round: 2 }),
      match(4n, 4n, {
        status: "completed",
        playerBId: 3n,
        table: 1,
        scoreA: 4,
        scoreB: 11,
        winnerId: 3n,
      }),
    ],
    tables: [
      { number: 1, status: "playing", matchId: 1n },
      { number: 2, status: "waiting", matchId: 2n },
      { number: 3, status: "available" },
    ],
  };
}
function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  render(
    <QueryClientProvider client={client}>
      <PlayersPage />
    </QueryClientProvider>,
  );
}
function names() {
  return within(screen.getByRole("table"))
    .getAllByRole("rowheader")
    .map((cell) => cell.textContent);
}
beforeEach(() => {
  state.auth.isAdmin = false;
  vi.resetAllMocks();
  state.actor.getTournaments.mockResolvedValue([
    tournament(1n, TournamentStatus.upcoming),
    tournament(2n),
  ]);
  state.manager.get.mockImplementation(async (_actor, id: bigint) =>
    lineup(id),
  );
});

describe("Players page", () => {
  it("opens the live tournament, shows its entrants in registration order and switches lineups", async () => {
    const user = userEvent.setup();
    state.manager.get.mockImplementation(async (_actor, id: bigint) =>
      id === 2n
        ? lineup()
        : {
            ...lineup(1n),
            players: [player(8n, "Tako", 3, "waiting")],
            matches: [],
          },
    );
    renderPage();
    await screen.findByRole("rowheader", { name: "Zara" });
    expect(screen.getByLabelText("Tournament")).toHaveValue("2");
    expect(names()).toEqual(["Zara", "Alex", "Nino", "Ana", "Beka"]);
    expect(
      screen.getByRole("link", { name: "Open tournament room" }),
    ).toHaveAttribute("href", "/tournaments/2");
    expect(screen.queryByRole("button", { name: "Add player" })).toBeNull();
    await user.selectOptions(screen.getByLabelText("Tournament"), "1");
    await screen.findByRole("rowheader", { name: "Tako" });
    expect(screen.queryByRole("rowheader", { name: "Zara" })).toBeNull();
  });

  it("combines name, skill, status, table and bracket-specific round filters and resets them", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("rowheader", { name: "Zara" });
    await user.type(screen.getByRole("searchbox"), "zAr");
    await user.selectOptions(screen.getByLabelText("Skill level"), "2");
    await user.selectOptions(screen.getByLabelText("Status"), "playing");
    await user.selectOptions(screen.getByLabelText("Table"), "1");
    await user.selectOptions(
      screen.getByLabelText("Current round"),
      "winners:1",
    );
    expect(names()).toEqual(["Zara"]);
    await user.selectOptions(
      screen.getByLabelText("Current round"),
      "losers:1",
    );
    expect(screen.getByText("No matching players.")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Reset filters & sort" }),
    );
    expect(names()).toEqual(["Zara", "Alex", "Nino", "Ana", "Beka"]);
    await user.selectOptions(
      screen.getByLabelText("Current round"),
      "winners:2",
    );
    expect(names()).toEqual(["Nino"]);
    await user.selectOptions(screen.getByLabelText("Current round"), "none");
    expect(names()).toEqual(["Ana", "Beka"]);
    await user.selectOptions(screen.getByLabelText("Status"), "removed");
    expect(names()).toEqual(["Giorgi"]);
  });

  it("offers every sort while keeping permanent registration numbers and timestamps", async () => {
    const user = userEvent.setup();
    const view = lineup();
    const before = view.players.map((player) => ({ ...player }));
    state.manager.get.mockResolvedValue(view);
    renderPage();
    await screen.findByRole("rowheader", { name: "Zara" });
    await user.selectOptions(screen.getByLabelText("Sort by"), "name");
    expect(names()).toEqual(["Alex", "Ana", "Beka", "Nino", "Zara"]);
    const zara = screen.getByRole("rowheader", { name: "Zara" }).closest("tr");
    expect(zara).toHaveTextContent("#001");
    expect(zara).toHaveTextContent("20:01");
    await user.selectOptions(screen.getByLabelText("Sort by"), "skill");
    expect(names()).toEqual(["Alex", "Zara", "Nino", "Beka", "Ana"]);
    await user.selectOptions(screen.getByLabelText("Sort by"), "status");
    expect(names()).toEqual(["Zara", "Alex", "Beka", "Nino", "Ana"]);
    await user.selectOptions(screen.getByLabelText("Sort by"), "registration");
    expect(names()).toEqual(["Zara", "Alex", "Nino", "Ana", "Beka"]);
    expect(view.players).toEqual(before);
  });

  it("lets an admin save player changes in the selected tournament", async () => {
    const user = userEvent.setup();
    state.auth.isAdmin = true;
    let view = lineup();
    state.manager.get.mockImplementation(async () => view);
    state.manager.apply.mockImplementation(async (_actor, id, action) => {
      expect(id).toBe(2n);
      view = {
        ...view,
        players: [
          ...view.players,
          player(7n, action.name, action.skill, "waiting"),
        ],
      };
      return view;
    });
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Add player" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.type(dialog.getByLabelText("Player name"), "Tako");
    await user.selectOptions(dialog.getByLabelText("Skill level"), "3");
    await user.click(
      dialog.getByRole("button", { name: "Add to waiting queue" }),
    );
    await screen.findByRole("rowheader", { name: "Tako" });
    expect(state.manager.apply).toHaveBeenCalledWith(
      state.actor,
      2n,
      { kind: "addPlayer", name: "Tako", skill: 3 },
      view.tournament,
    );
    expect(
      screen.getByText("Player changes saved to the tournament."),
    ).toBeVisible();
  });

  it("shows separate empty and retryable error states", async () => {
    const user = userEvent.setup();
    state.actor.getTournaments
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValue([]);
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The lineup is offline.",
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("The lineup starts with a tournament.");
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });
});
