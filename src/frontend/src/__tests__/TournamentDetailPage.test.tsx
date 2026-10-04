import {
  type Tournament,
  TournamentBracket,
  type TournamentCommand,
  TournamentElimination,
  TournamentFormat,
  type TournamentMatch,
  TournamentMatchStatus,
  type TournamentPlayer,
  TournamentPlayerStatus,
  TournamentSlot,
  type TournamentState,
  TournamentStatus,
  TournamentTableStatus,
} from "@/backend";
import { TournamentDetailPage } from "@/pages/TournamentDetailPage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  auth: { isAdmin: false },
  actor: {
    getTournament: vi.fn(),
    getTournamentState: vi.fn(),
    applyTournamentCommand: vi.fn(),
  },
}));

vi.mock("@caffeineai/core-infrastructure", () => ({
  useActor: () => ({ actor: state.actor, isFetching: false }),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => state.auth }));

const registeredAt = BigInt(Date.parse("2026-10-09T14:04:00Z")) * 1_000_000n;
const tournament: Tournament = {
  id: 1n,
  title: "Warehouse Cup",
  description: "Bring your paddle",
  venue: "ChillPong Bar",
  startsAt: registeredAt,
  format: TournamentFormat.singles,
  capacity: 4n,
  status: TournamentStatus.live,
  createdAt: registeredAt,
  updatedAt: registeredAt,
};

function player(id: bigint, name: string): TournamentPlayer {
  const playing = id <= 2n;
  return {
    id,
    name,
    skillLevel: 2n,
    registrationNumber: id,
    registeredAt: registeredAt + id * 60_000_000_000n,
    status: playing
      ? TournamentPlayerStatus.playing
      : TournamentPlayerStatus.ready,
    currentMatchId: playing ? 1n : 2n,
    table: playing ? 1n : undefined,
    losses: 0n,
  };
}

function match(
  id: bigint,
  overrides: Partial<TournamentMatch> = {},
): TournamentMatch {
  return {
    id,
    bracket: TournamentBracket.winners,
    round: 1n,
    position: id,
    sourceA: { __kind__: "player", player: id * 2n - 1n },
    sourceB: { __kind__: "player", player: id * 2n },
    playerA: id * 2n - 1n,
    playerB: id * 2n,
    status: TournamentMatchStatus.ready,
    priority: 0n,
    manualOverride: false,
    ...overrides,
  };
}

function room(overrides: Partial<TournamentState> = {}): TournamentState {
  return {
    tournamentId: 1n,
    elimination: TournamentElimination.singleElimination,
    tableCount: 2n,
    started: true,
    players: [
      player(1n, "Alex"),
      player(2n, "John"),
      player(3n, "Mike"),
      player(4n, "Peter"),
    ],
    matches: [
      match(1n, { status: TournamentMatchStatus.playing, table: 1n }),
      match(2n),
      match(3n, {
        round: 2n,
        position: 1n,
        sourceA: { __kind__: "winner", winner: 1n },
        sourceB: { __kind__: "winner", winner: 2n },
        playerA: undefined,
        playerB: undefined,
        status: TournamentMatchStatus.blocked,
      }),
    ],
    waitingQueue: [3n, 4n],
    nextMatches: [2n],
    tables: [
      { number: 1n, status: TournamentTableStatus.playing, matchId: 1n },
      { number: 2n, status: TournamentTableStatus.available },
    ],
    history: [
      { id: 7n, caption: "Started Winners / R1 / M1", createdAt: registeredAt },
    ],
    canUndo: true,
    updatedAt: registeredAt,
    ...overrides,
  };
}

function renderRoom() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  const rootRoute = createRootRoute({
    component: () => (
      <QueryClientProvider client={queryClient}>
        <TournamentDetailPage tournamentId={1n} />
      </QueryClientProvider>
    ),
  });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return render(<RouterProvider router={router} />);
}

function playerRow(name: string) {
  const table = screen.getByTestId("tournament.players_table");
  return within(table).getByRole("rowheader", { name }).closest("tr")!;
}

function saveStates(...states: TournamentState[]) {
  state.actor.applyTournamentCommand.mockImplementation(async () => {
    const updated = states.shift();
    if (!updated) throw new Error("Unexpected organizer command");
    state.actor.getTournamentState.mockResolvedValue(updated);
    return updated;
  });
}

beforeEach(() => {
  state.auth.isAdmin = false;
  for (const method of Object.values(state.actor)) method.mockReset();
  state.actor.getTournament.mockResolvedValue(tournament);
  state.actor.getTournamentState.mockResolvedValue(room());
});

describe("live tournament room", () => {
  it("lets spectators inspect the floor and complete bracket without organizer controls", async () => {
    const user = userEvent.setup();
    renderRoom();
    await screen.findByRole("heading", { name: "Warehouse Cup" });

    expect(screen.getByRole("heading", { name: "On the floor" })).toBeVisible();
    const queue = screen.getByTestId("tournament.waiting_queue");
    expect(within(queue).getByText("Mike")).toBeVisible();
    expect(within(queue).getByText("Peter")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Add player" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Undo last action" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /^Edit |^Remove |Assign next/ }),
    ).toBeNull();
    await user.click(screen.getByTestId("match.card.1"));
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText(/Results and assignments are managed/),
    ).toBeVisible();
    expect(
      within(dialog).queryByRole("button", { name: "Save result" }),
    ).toBeNull();
    expect(within(dialog).queryByLabelText("Score A")).toBeNull();
    await user.click(within(dialog).getByRole("button", { name: "Close" }));

    await user.click(screen.getByRole("button", { name: "Extended view" }));
    expect(
      screen.getByRole("region", { name: "Complete tournament bracket" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Extended view" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("match.card.3")).toHaveTextContent(
      "Winner / W1.1",
    );
    await user.click(screen.getByRole("button", { name: "Zoom bracket out" }));
    expect(screen.getByLabelText("Bracket zoom")).toHaveTextContent("90%");
    await user.click(screen.getByRole("button", { name: "Standard view" }));
    expect(screen.getByRole("heading", { name: "Next matches" })).toBeVisible();
    expect(state.actor.applyTournamentCommand).not.toHaveBeenCalled();
  });

  it("adds a late player to the saved queue and edits skill without changing registration", async () => {
    const user = userEvent.setup();
    state.auth.isAdmin = true;
    const late = {
      ...player(5n, "Late Arrival"),
      status: TournamentPlayerStatus.waiting,
      currentMatchId: undefined,
      skillLevel: 3n,
    };
    const added = room({
      players: [...room().players, late],
      waitingQueue: [3n, 4n, 5n],
    });
    saveStates(added, {
      ...added,
      players: added.players.map((item) =>
        item.id === 5n ? { ...item, skillLevel: 4n } : item,
      ),
    });
    renderRoom();
    await user.click(
      (await screen.findAllByRole("button", { name: "Add player" }))[0]!,
    );
    let dialog = screen.getByRole("dialog");
    await user.type(
      within(dialog).getByLabelText("Player name"),
      "  Late Arrival  ",
    );
    await user.selectOptions(within(dialog).getByLabelText("Skill level"), "3");
    await user.click(
      within(dialog).getByRole("button", { name: "Add to waiting queue" }),
    );
    await waitFor(() =>
      expect(state.actor.applyTournamentCommand).toHaveBeenCalledWith(1n, {
        __kind__: "addPlayer",
        addPlayer: { name: "Late Arrival", skillLevel: 3n },
      } satisfies TournamentCommand),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(playerRow("Late Arrival")).toHaveTextContent("#005");
    expect(playerRow("Late Arrival")).toHaveTextContent("L3");
    const registration =
      playerRow("Late Arrival").querySelector("td")!.textContent;
    expect(
      within(screen.getByTestId("tournament.waiting_queue")).getByText(
        "Late Arrival",
      ),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Edit Late Arrival" }));
    dialog = screen.getByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText("Skill level"), "4");
    await user.click(
      within(dialog).getByRole("button", { name: "Save player" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(state.actor.applyTournamentCommand).toHaveBeenLastCalledWith(1n, {
      __kind__: "editPlayer",
      editPlayer: { playerId: 5n, name: "Late Arrival", skillLevel: 4n },
    } satisfies TournamentCommand);
    expect(playerRow("Late Arrival")).toHaveTextContent("L4");
    expect(playerRow("Late Arrival").querySelector("td")!.textContent).toBe(
      registration,
    );
  });

  it("moves an advanced winner through their pending round instead of their scored opening match", async () => {
    const user = userEvent.setup();
    state.auth.isAdmin = true;
    const players = [
      "Alex",
      "John",
      "Mike",
      "Peter",
      "Maria",
      "David",
      "Giorgi",
      "Sarah",
    ].map((name, index) => player(BigInt(index + 1), name));
    const advanced = room({
      players: players.map((item) => ({
        ...item,
        table: undefined,
        status: [2n, 6n].includes(item.id)
          ? TournamentPlayerStatus.eliminated
          : [1n, 5n].includes(item.id)
            ? TournamentPlayerStatus.waiting
            : TournamentPlayerStatus.ready,
        losses: [2n, 6n].includes(item.id) ? 1n : 0n,
        currentMatchId:
          item.id === 1n
            ? 5n
            : item.id === 5n
              ? 6n
              : [3n, 4n].includes(item.id)
                ? 2n
                : [7n, 8n].includes(item.id)
                  ? 4n
                  : undefined,
      })),
      matches: [
        match(1n, {
          status: TournamentMatchStatus.completed,
          scoreA: 11n,
          scoreB: 7n,
          winnerId: 1n,
          loserId: 2n,
        }),
        match(2n),
        match(3n, {
          status: TournamentMatchStatus.completed,
          scoreA: 11n,
          scoreB: 7n,
          winnerId: 5n,
          loserId: 6n,
        }),
        match(4n),
        match(5n, {
          round: 2n,
          position: 1n,
          sourceA: { __kind__: "winner", winner: 1n },
          sourceB: { __kind__: "winner", winner: 2n },
          playerA: 1n,
          playerB: undefined,
          status: TournamentMatchStatus.blocked,
        }),
        match(6n, {
          round: 2n,
          position: 2n,
          sourceA: { __kind__: "winner", winner: 3n },
          sourceB: { __kind__: "winner", winner: 4n },
          playerA: 5n,
          playerB: undefined,
          status: TournamentMatchStatus.blocked,
        }),
      ],
      waitingQueue: [1n, 3n, 4n, 5n, 7n, 8n],
      nextMatches: [2n, 4n],
      tables: [
        { number: 1n, status: TournamentTableStatus.finished, matchId: 3n },
        { number: 2n, status: TournamentTableStatus.available },
      ],
    });
    state.actor.getTournamentState.mockResolvedValue(advanced);
    saveStates(advanced);
    renderRoom();
    await user.click(await screen.findByRole("button", { name: "Move Alex" }));
    const dialog = screen.getByRole("dialog");
    const destination = within(dialog).getByLabelText("Destination match");
    const options = within(destination).getAllByRole("option");
    expect(options.map((option) => option.getAttribute("value"))).toEqual([
      "6",
      "5",
    ]);
    expect(options[0]).toHaveTextContent("Winner / W1.4");
    expect(
      options.every((option) => !option.textContent?.includes("BYE")),
    ).toBe(true);
    await user.selectOptions(destination, "6");
    await user.selectOptions(
      within(dialog).getByLabelText("Destination slot"),
      "b",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Place player" }),
    );
    await waitFor(() =>
      expect(state.actor.applyTournamentCommand).toHaveBeenCalledWith(1n, {
        __kind__: "movePlayer",
        movePlayer: { playerId: 1n, matchId: 6n, slot: TournamentSlot.b },
      } satisfies TournamentCommand),
    );
  });

  it("lets the organizer switch an unplayed draw to double elimination while preserving the lineup", async () => {
    const user = userEvent.setup();
    state.auth.isAdmin = true;
    const unplayed = room({
      matches: room().matches.map((item) =>
        item.id === 1n
          ? { ...item, status: TournamentMatchStatus.ready, table: undefined }
          : item,
      ),
      players: room().players.map((item) => ({
        ...item,
        status: TournamentPlayerStatus.ready,
        table: undefined,
      })),
      tables: [1n, 2n].map((number) => ({
        number,
        status: TournamentTableStatus.available,
      })),
    });
    state.actor.getTournamentState.mockResolvedValue(unplayed);
    const extra = [
      TournamentBracket.losers,
      TournamentBracket.grandFinal,
      TournamentBracket.resetFinal,
    ].map((bracket, index) =>
      match(BigInt(index + 4), {
        bracket,
        position: 1n,
        playerA: undefined,
        playerB: undefined,
        sourceA: { __kind__: "loser", loser: 1n },
        sourceB: { __kind__: "loser", loser: 2n },
        status: TournamentMatchStatus.blocked,
      }),
    );
    saveStates({
      ...unplayed,
      elimination: TournamentElimination.doubleElimination,
      matches: [...unplayed.matches, ...extra],
    });
    renderRoom();
    const format = await screen.findByLabelText("Elimination format");
    expect(format).toBeEnabled();
    const registrations = unplayed.players.map(
      (item) => playerRow(item.name).querySelector("td")!.textContent,
    );
    await user.selectOptions(format, "double");
    await user.click(screen.getByRole("button", { name: "Save setup" }));
    await waitFor(() =>
      expect(state.actor.applyTournamentCommand).toHaveBeenCalledWith(1n, {
        __kind__: "configure",
        configure: {
          elimination: TournamentElimination.doubleElimination,
          tableCount: 2n,
        },
      } satisfies TournamentCommand),
    );
    await user.click(screen.getByRole("button", { name: "Extended view" }));
    const bracket = screen.getByRole("region", {
      name: "Complete tournament bracket",
    });
    expect(within(bracket).getByText("Losers bracket")).toBeVisible();
    expect(within(bracket).getByText("Grand final")).toBeVisible();
    expect(within(bracket).getByText("Reset final")).toBeVisible();
    expect(
      unplayed.players.map(
        (item) => playerRow(item.name).querySelector("td")!.textContent,
      ),
    ).toEqual(registrations);
  });

  it("rejects a tied score, saves a winner, and waits for confirmation before undo", async () => {
    const user = userEvent.setup();
    state.auth.isAdmin = true;
    const before = room();
    const completed = room({
      matches: before.matches.map((item) =>
        item.id === 1n
          ? {
              ...item,
              status: TournamentMatchStatus.completed,
              scoreA: 11n,
              scoreB: 7n,
              winnerId: 1n,
              loserId: 2n,
            }
          : item,
      ),
      players: before.players.map((item) =>
        item.id === 1n
          ? { ...item, status: TournamentPlayerStatus.advanced }
          : item.id === 2n
            ? { ...item, losses: 1n, status: TournamentPlayerStatus.eliminated }
            : item,
      ),
      tables: [
        { number: 1n, status: TournamentTableStatus.finished, matchId: 1n },
        before.tables[1]!,
      ],
      history: [
        ...before.history,
        { id: 8n, caption: "Saved result 11–7", createdAt: registeredAt },
      ],
    });
    saveStates(completed, before);
    renderRoom();
    await screen.findByRole("heading", { name: "Warehouse Cup" });
    await user.click(screen.getByRole("button", { name: "Table setup" }));
    expect(screen.getByLabelText("Elimination format")).toBeDisabled();
    await user.click(screen.getByTestId("match.card.1"));
    let dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Score A"), "7");
    await user.type(within(dialog).getByLabelText("Score B"), "7");
    await user.click(
      within(dialog).getByRole("button", { name: "Save result" }),
    );
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Scores cannot be tied",
    );
    expect(state.actor.applyTournamentCommand).not.toHaveBeenCalled();
    await user.clear(within(dialog).getByLabelText("Score A"));
    await user.type(within(dialog).getByLabelText("Score A"), "11");
    await user.click(
      within(dialog).getByRole("button", { name: "Save result" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(state.actor.applyTournamentCommand).toHaveBeenCalledWith(1n, {
      __kind__: "recordResult",
      recordResult: { matchId: 1n, scoreA: 11n, scoreB: 7n },
    } satisfies TournamentCommand);
    expect(screen.getByTestId("match.card.1")).toHaveTextContent("11");
    expect(playerRow("John")).toHaveTextContent("eliminated");
    expect(
      within(screen.getByTestId("tournament.tables")).getByText("finished"),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Undo last action" }));
    dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Saved result 11–7")).toBeVisible();
    expect(state.actor.applyTournamentCommand).toHaveBeenCalledTimes(1);
    await user.click(
      within(dialog).getByRole("button", { name: "Confirm undo" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(state.actor.applyTournamentCommand).toHaveBeenLastCalledWith(1n, {
      __kind__: "undo",
      undo: null,
    });
    expect(playerRow("John")).toHaveTextContent("playing");
  });

  it("explains active-player withdrawal and only removes them after confirmation", async () => {
    const user = userEvent.setup();
    state.auth.isAdmin = true;
    saveStates(
      room({
        players: room().players.map((item) =>
          item.id === 1n
            ? { ...item, status: TournamentPlayerStatus.removed }
            : item,
        ),
      }),
    );
    renderRoom();
    await user.click(
      await screen.findByRole("button", { name: "Remove Alex" }),
    );
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText(/currently playing.*forfeit/),
    ).toBeVisible();
    expect(
      within(dialog).getByText(/Completed results remain in history/),
    ).toBeVisible();
    expect(state.actor.applyTournamentCommand).not.toHaveBeenCalled();
    await user.click(
      within(dialog).getByRole("button", { name: "Remove player" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(state.actor.applyTournamentCommand).toHaveBeenCalledWith(1n, {
      __kind__: "removePlayer",
      removePlayer: { playerId: 1n, confirmed: true },
    } satisfies TournamentCommand);
    expect(
      within(screen.getByTestId("tournament.players_table")).queryByRole(
        "rowheader",
        { name: "Alex" },
      ),
    ).toBeNull();
    await user.click(screen.getByLabelText("Include removed players"));
    expect(playerRow("Alex")).toHaveTextContent("removed");
    expect(playerRow("Alex")).toHaveTextContent("#001");
  });

  it("keeps a failed organizer action open without showing a saved state", async () => {
    const user = userEvent.setup();
    state.auth.isAdmin = true;
    state.actor.applyTournamentCommand.mockRejectedValue(
      new Error("The tournament has already finished."),
    );
    renderRoom();
    await user.click(
      (await screen.findAllByRole("button", { name: "Add player" }))[0]!,
    );
    const dialog = screen.getByRole("dialog");
    await user.type(
      within(dialog).getByLabelText("Player name"),
      "Late Arrival",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Add to waiting queue" }),
    );
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "The tournament has already finished.",
    );
    expect(within(dialog).getByLabelText("Player name")).toHaveValue(
      "Late Arrival",
    );
    expect(screen.queryByTestId("tournament.saved_state")).toBeNull();
    expect(
      within(screen.getByTestId("tournament.players_table")).queryByRole(
        "rowheader",
        { name: "Late Arrival" },
      ),
    ).toBeNull();
  });

  it("shows a recoverable load failure and a separate missing-room state", async () => {
    const user = userEvent.setup();
    state.actor.getTournamentState
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValueOnce(undefined);
    renderRoom();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The match desk is offline.",
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("heading", { name: "Tournament not found." }),
    ).toBeVisible();
    expect(state.actor.getTournamentState).toHaveBeenCalledTimes(2);
    expect(state.actor.applyTournamentCommand).not.toHaveBeenCalled();
  });
});
