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
import { setLanguage } from "@/i18n";
import { TournamentDetailPage } from "@/pages/TournamentDetailPage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  auth: { isAdmin: true },
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

const registeredAt = 1_786_108_800_000_000_000n;
const tournament: Tournament = {
  id: 1n,
  title: "Phone Night Cup",
  description: "Run the floor from your phone",
  venue: "ChillPong Bar",
  startsAt: registeredAt,
  format: TournamentFormat.singles,
  capacity: 4n,
  status: TournamentStatus.live,
  createdAt: registeredAt,
  updatedAt: registeredAt,
};

function player(id: bigint, name: string): TournamentPlayer {
  return {
    id,
    name,
    skillLevel: 2n,
    registrationNumber: id,
    registeredAt,
    status:
      id <= 2n ? TournamentPlayerStatus.playing : TournamentPlayerStatus.ready,
    currentMatchId: id <= 2n ? 1n : 2n,
    table: id <= 2n ? 1n : undefined,
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
      player(1n, "Nino"),
      player(2n, "Giorgi"),
      player(3n, "Ana"),
      player(4n, "Davit"),
    ],
    matches: [
      match(1n, { status: TournamentMatchStatus.playing, table: 1n }),
      match(2n),
    ],
    waitingQueue: [3n, 4n],
    nextMatches: [2n],
    tables: [
      { number: 1n, status: TournamentTableStatus.playing, matchId: 1n },
      { number: 2n, status: TournamentTableStatus.available },
    ],
    history: [],
    canUndo: false,
    updatedAt: registeredAt,
    ...overrides,
  };
}

function completedRoom(scoreA = 11n, scoreB = 7n): TournamentState {
  const original = room();
  return room({
    matches: original.matches.map((item) =>
      item.id === 1n
        ? {
            ...item,
            status: TournamentMatchStatus.completed,
            scoreA,
            scoreB,
            winnerId: 1n,
            loserId: 2n,
          }
        : item,
    ),
    players: original.players.map((item) =>
      item.id === 1n
        ? { ...item, status: TournamentPlayerStatus.advanced, table: undefined }
        : item.id === 2n
          ? {
              ...item,
              status: TournamentPlayerStatus.eliminated,
              losses: 1n,
              table: undefined,
            }
          : item,
    ),
    tables: [
      { number: 1n, status: TournamentTableStatus.finished, matchId: 1n },
      original.tables[1]!,
    ],
    history: [{ id: 1n, caption: "Saved result", createdAt: registeredAt }],
    canUndo: true,
  });
}

function readyRoom(overrides: Partial<TournamentState> = {}): TournamentState {
  const original = room();
  return room({
    players: original.players.map((item) => ({
      ...item,
      status: TournamentPlayerStatus.ready,
      table: undefined,
    })),
    matches: [match(1n), match(2n)],
    waitingQueue: [1n, 2n, 3n, 4n],
    nextMatches: [1n, 2n],
    tables: [1n, 2n].map((number) => ({
      number,
      status: TournamentTableStatus.available,
    })),
    ...overrides,
  });
}

function saveStates(...saved: TournamentState[]) {
  state.actor.applyTournamentCommand.mockImplementation(async () => {
    const updated = saved.shift();
    if (!updated) throw new Error("Unexpected organizer command");
    state.actor.getTournamentState.mockResolvedValue(updated);
    return updated;
  });
}

function renderRoom(fullscreen = false) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  const rootRoute = createRootRoute({
    validateSearch: (search: Record<string, unknown>) => ({
      view: search.view === "bracket" ? "bracket" : undefined,
    }),
    component: () => (
      <QueryClientProvider client={client}>
        <TournamentDetailPage tournamentId={1n} />
      </QueryClientProvider>
    ),
  });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({
      initialEntries: [fullscreen ? "/?view=bracket" : "/"],
    }),
  });
  return render(<RouterProvider router={router} />);
}

function touch(target: HTMLElement, type: "pointerdown" | "pointerup") {
  // jsdom lacks PointerEvent; keep the pointer fields consumed by React and
  // bubble the touch through the real bracket navigation handlers.
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    buttons: type === "pointerdown" ? 1 : 0,
    clientX: 100,
    clientY: 100,
  });
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: "touch" },
    isPrimary: { value: true },
  });
  fireEvent(target, event);
}

beforeEach(() => {
  setLanguage("en");
  localStorage.clear();
  vi.stubGlobal("innerWidth", 390);
  vi.stubGlobal("innerHeight", 844);
  state.auth.isAdmin = true;
  for (const method of Object.values(state.actor)) method.mockReset();
  state.actor.getTournament.mockResolvedValue(tournament);
  state.actor.getTournamentState.mockResolvedValue(room());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("mobile organizer match workflow", () => {
  it("makes score entry discoverable on a playing table and saves a finished result", async () => {
    const user = userEvent.setup();
    saveStates(completedRoom());
    renderRoom();
    const card = await screen.findByTestId("match.card.1");
    expect(within(card).getByText("Enter score")).toBeVisible();
    touch(card, "pointerdown");
    touch(card, "pointerup");
    fireEvent.click(card, { detail: 1 });

    const dialog = screen.getByRole("dialog");
    const scoreA = within(dialog).getByLabelText("Score A");
    const scoreB = within(dialog).getByLabelText("Score B");
    expect(scoreA).toHaveAttribute("inputmode", "numeric");
    expect(scoreB).toHaveAttribute("inputmode", "numeric");
    expect(scoreA).not.toHaveFocus();
    expect(scoreB).not.toHaveFocus();
    const assignTable = within(dialog).getByRole("combobox", {
      name: "Assign table",
    });
    expect(
      scoreA.compareDocumentPosition(assignTable) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await user.type(scoreA, "11");
    await user.type(scoreB, "7");
    await user.click(
      within(dialog).getByRole("button", {
        name: "Save result & finish match",
      }),
    );

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(state.actor.applyTournamentCommand).toHaveBeenCalledExactlyOnceWith(
      1n,
      {
        __kind__: "recordResult",
        recordResult: { matchId: 1n, scoreA: 11n, scoreB: 7n },
      } satisfies TournamentCommand,
    );
    expect(screen.getByTestId("match.card.1")).toHaveTextContent("11");
    expect(screen.getByTestId("match.card.1")).toHaveTextContent("7");
    expect(
      within(screen.getByTestId("tournament.tables")).getByText("finished"),
    ).toBeVisible();
    expect(
      within(screen.getByTestId("match.card.1")).getByText(
        "Correct the result",
      ),
    ).toBeVisible();
  });

  it("keeps table assignment and starting a ready match available before score entry", async () => {
    const user = userEvent.setup();
    const ready = room({
      matches: [match(1n), match(2n)],
      nextMatches: [1n, 2n],
      tables: [1n, 2n].map((number) => ({
        number,
        status: TournamentTableStatus.available,
      })),
    });
    const assigned = {
      ...ready,
      matches: ready.matches.map((item) =>
        item.id === 1n ? { ...item, table: 1n } : item,
      ),
      tables: [
        { number: 1n, status: TournamentTableStatus.waiting, matchId: 1n },
        ready.tables[1]!,
      ],
    };
    const playing = room();
    state.actor.getTournamentState.mockResolvedValue(ready);
    saveStates(assigned, playing);
    renderRoom();
    const card = await screen.findByTestId("match.card.1");
    expect(within(card).getByText("Manage match")).toBeVisible();
    await user.click(card);
    let dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Score A")).toBeVisible();
    expect(
      within(dialog).getByRole("button", { name: "Start match" }),
    ).toBeDisabled();
    await user.selectOptions(
      within(dialog).getByRole("combobox", { name: "Assign table" }),
      "1",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Assign table" }),
    );
    await waitFor(() =>
      expect(state.actor.applyTournamentCommand).toHaveBeenCalledWith(1n, {
        __kind__: "assignTable",
        assignTable: { matchId: 1n, table: 1n },
      } satisfies TournamentCommand),
    );
    dialog = screen.getByRole("dialog");
    await waitFor(() =>
      expect(
        within(dialog).getByRole("button", { name: "Start match" }),
      ).toBeEnabled(),
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Start match" }),
    );
    await waitFor(() =>
      expect(state.actor.applyTournamentCommand).toHaveBeenLastCalledWith(1n, {
        __kind__: "startMatch",
        startMatch: 1n,
      } satisfies TournamentCommand),
    );
    dialog = screen.getByRole("dialog");
    expect(await within(dialog).findByLabelText("Score A")).toBeVisible();
    expect(
      within(dialog).getByRole("button", {
        name: "Save result & finish match",
      }),
    ).toBeEnabled();
  });

  it.each([
    ["phone", 390],
    ["desktop", 1280],
  ])(
    "assigns a ready match to an occupied table from the match editor on %s",
    async (_device, width) => {
      vi.stubGlobal("innerWidth", width);
      const user = userEvent.setup();
      const original = room();
      const reassigned = room({
        players: original.players.map((item) => ({
          ...item,
          status: TournamentPlayerStatus.ready,
          table: item.id > 2n ? 1n : undefined,
        })),
        matches: [match(1n), match(2n, { table: 1n })],
        waitingQueue: [1n, 2n],
        nextMatches: [1n, 2n],
        tables: [
          { number: 1n, status: TournamentTableStatus.waiting, matchId: 2n },
          original.tables[1]!,
        ],
      });
      saveStates(reassigned);
      renderRoom();
      await user.click(await screen.findByTestId("match.card.2"));
      const dialog = screen.getByRole("dialog");
      const table = within(dialog).getByRole("combobox", {
        name: "Assign table",
      });
      const assign = within(dialog).getByRole("button", {
        name: "Assign table",
      });
      expect(assign).toBeDisabled();
      expect(
        within(table).getByRole("option", { name: "Table 1 / playing" }),
      ).toBeEnabled();
      await user.selectOptions(table, "1");
      expect(within(dialog).getByRole("status")).toHaveTextContent(
        "The match currently on table 1 returns to ready without a table.",
      );
      expect(assign).toBeEnabled();
      await user.click(assign);
      await waitFor(() =>
        expect(
          state.actor.applyTournamentCommand,
        ).toHaveBeenCalledExactlyOnceWith(1n, {
          __kind__: "assignTable",
          assignTable: { matchId: 2n, table: 1n },
        } satisfies TournamentCommand),
      );
      await waitFor(() => expect(table).toHaveValue("1"));
      await waitFor(() => expect(assign).toBeDisabled());
      expect(screen.getByRole("dialog")).toBeVisible();
      expect(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Start match",
        }),
      ).toBeEnabled();
    },
  );

  it.each([
    ["phone", 390],
    ["desktop", 1280],
  ])(
    "exchanges occupied tables from a playing match editor on %s",
    async (_device, width) => {
      vi.stubGlobal("innerWidth", width);
      const user = userEvent.setup();
      const original = room();
      const playing = room({
        players: original.players.map((item) => ({
          ...item,
          status: TournamentPlayerStatus.playing,
          table: item.id <= 2n ? 1n : 2n,
        })),
        matches: [
          match(1n, { status: TournamentMatchStatus.playing, table: 1n }),
          match(2n, { status: TournamentMatchStatus.playing, table: 2n }),
        ],
        waitingQueue: [],
        nextMatches: [],
        tables: [1n, 2n].map((number) => ({
          number,
          status: TournamentTableStatus.playing,
          matchId: number,
        })),
      });
      state.actor.getTournamentState.mockResolvedValue(playing);
      saveStates({
        ...playing,
        players: playing.players.map((item) => ({
          ...item,
          table: item.id <= 2n ? 2n : 1n,
        })),
        matches: playing.matches.map((item) => ({
          ...item,
          table: item.id === 1n ? 2n : 1n,
        })),
        tables: playing.tables.map((item) => ({
          ...item,
          matchId: item.number === 1n ? 2n : 1n,
        })),
      });
      renderRoom();
      await user.click(await screen.findByTestId("match.card.1"));
      const dialog = screen.getByRole("dialog");
      const table = within(dialog).getByRole("combobox", {
        name: "Assign table",
      });
      const assign = within(dialog).getByRole("button", {
        name: "Assign table",
      });
      expect(assign).toBeDisabled();
      expect(
        within(table).getByRole("option", { name: "Table 2 / playing" }),
      ).toBeEnabled();
      await user.selectOptions(table, "2");
      expect(within(dialog).getByRole("status")).toHaveTextContent(
        "Table assignments will be exchanged with table 2.",
      );
      await user.click(assign);
      await waitFor(() =>
        expect(
          state.actor.applyTournamentCommand,
        ).toHaveBeenCalledExactlyOnceWith(1n, {
          __kind__: "assignTable",
          assignTable: { matchId: 1n, table: 2n },
        } satisfies TournamentCommand),
      );
      await waitFor(() => expect(table).toHaveValue("2"));
      await waitFor(() => expect(assign).toBeDisabled());
      expect(screen.getByRole("dialog")).toBeVisible();
      expect(within(dialog).getByLabelText("Score A")).toBeEnabled();
    },
  );

  it.each([
    ["phone", 390],
    ["desktop", 1280],
  ])(
    "releases a playing match's table from its editor on %s",
    async (_device, width) => {
      vi.stubGlobal("innerWidth", width);
      const user = userEvent.setup();
      saveStates(readyRoom());
      renderRoom();
      await user.click(await screen.findByTestId("match.card.1"));
      const dialog = screen.getByRole("dialog");
      const table = within(dialog).getByRole("combobox", {
        name: "Assign table",
      });
      const assign = within(dialog).getByRole("button", {
        name: "Assign table",
      });
      await user.selectOptions(table, "");
      expect(within(dialog).getByRole("status")).toHaveTextContent(
        "The current match returns to ready without a table. Results and bracket progress are preserved.",
      );
      await user.click(assign);
      await waitFor(() =>
        expect(
          state.actor.applyTournamentCommand,
        ).toHaveBeenCalledExactlyOnceWith(1n, {
          __kind__: "assignTable",
          assignTable: { matchId: 1n, table: undefined },
        } satisfies TournamentCommand),
      );
      await waitFor(() => expect(table).toHaveValue(""));
      await waitFor(() => expect(assign).toBeDisabled());
      expect(
        within(dialog).getByRole("button", { name: "Start match" }),
      ).toBeDisabled();
    },
  );

  it("allows a completed result to be corrected and requires confirmation for a reset", async () => {
    const user = userEvent.setup();
    state.actor.getTournamentState.mockResolvedValue(completedRoom());
    saveStates(completedRoom(11n, 9n), room());
    renderRoom();
    const card = await screen.findByTestId("match.card.1");
    expect(within(card).getByText("Correct the result")).toBeVisible();
    await user.click(card);
    let dialog = screen.getByRole("dialog");
    const scoreB = within(dialog).getByLabelText("Score B");
    expect(scoreB).toHaveValue(7);
    await user.clear(scoreB);
    await user.type(scoreB, "9");
    await user.click(
      within(dialog).getByRole("button", { name: "Save result" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(state.actor.applyTournamentCommand).toHaveBeenCalledWith(1n, {
      __kind__: "recordResult",
      recordResult: { matchId: 1n, scoreA: 11n, scoreB: 9n },
    } satisfies TournamentCommand);

    await user.click(screen.getByTestId("match.card.1"));
    dialog = screen.getByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", {
        name: "Reset match / undo result",
      }),
    );
    dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Reset this result?" }),
    ).toBeVisible();
    expect(state.actor.applyTournamentCommand).toHaveBeenCalledTimes(1);
    await user.click(
      within(dialog).getByRole("checkbox", {
        name: /Also reset completed downstream results/,
      }),
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Confirm reset" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(state.actor.applyTournamentCommand).toHaveBeenLastCalledWith(1n, {
      __kind__: "resetMatch",
      resetMatch: { matchId: 1n, cascade: true },
    } satisfies TournamentCommand);
  });

  it.each(["extended", "fullscreen"])(
    "opens the score form when a playing match is tapped in the %s bracket",
    async (display) => {
      const user = userEvent.setup();
      saveStates(completedRoom());
      renderRoom(display === "fullscreen");
      if (display === "extended") {
        await user.click(
          await screen.findByRole("button", { name: "Extended view" }),
        );
      }
      const card = await screen.findByTestId("match.card.1");
      expect(within(card).getByText("Enter score")).toBeVisible();
      touch(card, "pointerdown");
      touch(card, "pointerup");
      fireEvent.click(card, { detail: 1 });

      const dialog = screen.getByRole("dialog");
      await user.type(within(dialog).getByLabelText("Score A"), "11");
      await user.type(within(dialog).getByLabelText("Score B"), "0");
      await user.click(
        within(dialog).getByRole("button", {
          name: "Save result & finish match",
        }),
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(
        state.actor.applyTournamentCommand,
      ).toHaveBeenCalledExactlyOnceWith(1n, {
        __kind__: "recordResult",
        recordResult: { matchId: 1n, scoreA: 11n, scoreB: 0n },
      } satisfies TournamentCommand);
    },
  );

  it.each(["Standard view", "Extended view"])(
    "keeps spectator match inspection read-only in %s",
    async (display) => {
      const user = userEvent.setup();
      state.auth.isAdmin = false;
      renderRoom();
      await screen.findByRole("heading", { name: "Phone Night Cup" });
      if (display === "Extended view") {
        await user.click(screen.getByRole("button", { name: display }));
      }
      const card = screen.getByTestId("match.card.1");
      expect(within(card).queryByText("Enter score")).toBeNull();
      expect(within(card).queryByText("Manage match")).toBeNull();
      expect(screen.queryByRole("button", { name: "Add player" })).toBeNull();
      expect(
        screen.queryByRole("button", { name: /Assign next match/ }),
      ).toBeNull();
      await user.click(card);
      const dialog = screen.getByRole("dialog");
      expect(
        within(dialog).getByText(/Results and assignments are managed/),
      ).toBeVisible();
      expect(within(dialog).queryByLabelText("Score A")).toBeNull();
      expect(
        within(dialog).queryByRole("button", { name: /^Edit / }),
      ).toBeNull();
      expect(
        within(dialog).queryByRole("combobox", { name: "Player A slot" }),
      ).toBeNull();
      expect(
        within(dialog).queryByRole("combobox", { name: "Assign table" }),
      ).toBeNull();
      expect(
        within(dialog).queryByRole("button", {
          name: /Save result|Start match|Reset match|Prioritize match/,
        }),
      ).toBeNull();
      expect(state.actor.applyTournamentCommand).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["phone", 390],
    ["desktop", 1280],
  ])(
    "edits a participant's name and skill from the match on %s while preserving their identity and score",
    async (_device, width) => {
      vi.stubGlobal("innerWidth", width);
      const user = userEvent.setup();
      const completed = completedRoom();
      const edited = {
        ...completed,
        players: completed.players.map((item) =>
          item.id === 1n ? { ...item, name: "Nina", skillLevel: 4n } : item,
        ),
      };
      state.actor.getTournamentState.mockResolvedValue(completed);
      saveStates(edited);
      renderRoom();
      await user.click(await screen.findByTestId("match.card.1"));
      let dialog = screen.getByRole("dialog");
      expect(
        within(dialog).getByRole("button", { name: "Edit Giorgi" }),
      ).toBeVisible();
      await user.click(
        within(dialog).getByRole("button", { name: "Edit Nino" }),
      );
      dialog = screen.getByRole("dialog");
      const name = within(dialog).getByLabelText("Player name");
      expect(name).toHaveValue("Nino");
      await user.clear(name);
      await user.type(name, "  Nina  ");
      await user.selectOptions(
        within(dialog).getByLabelText("Skill level"),
        "4",
      );
      await user.click(
        within(dialog).getByRole("button", { name: "Save player" }),
      );
      await waitFor(() =>
        expect(
          state.actor.applyTournamentCommand,
        ).toHaveBeenCalledExactlyOnceWith(1n, {
          __kind__: "editPlayer",
          editPlayer: { playerId: 1n, name: "Nina", skillLevel: 4n },
        } satisfies TournamentCommand),
      );
      dialog = screen.getByRole("dialog");
      expect(
        await within(dialog).findByRole("button", { name: "Edit Nina" }),
      ).toBeVisible();
      expect(
        within(dialog).getByRole("heading", { name: "Match W1.1" }),
      ).toBeVisible();
      expect(within(dialog).getByLabelText("Score A")).toHaveValue(11);
      expect(within(dialog).getByLabelText("Score B")).toHaveValue(7);
      expect(within(dialog).getByText(/L4.*#001/)).toBeVisible();
      expect(screen.getByTestId("match.card.1")).toHaveTextContent("Nina");
      expect(screen.getByTestId("match.card.1")).toHaveTextContent("#001");
    },
  );

  it("returns from participant editing without saving a cancelled draft", async () => {
    const user = userEvent.setup();
    state.actor.getTournamentState.mockResolvedValue(completedRoom());
    renderRoom();
    await user.click(await screen.findByTestId("match.card.1"));
    let dialog = screen.getByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Edit Giorgi" }),
    );
    dialog = screen.getByRole("dialog");
    const name = within(dialog).getByLabelText("Player name");
    await user.clear(name);
    await user.type(name, "Unsaved draft");
    await user.click(
      within(dialog).getByRole("button", { name: "Back to match" }),
    );
    dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("button", { name: "Edit Giorgi" }),
    ).toBeVisible();
    expect(within(dialog).queryByText("Unsaved draft")).toBeNull();
    expect(within(dialog).getByLabelText("Score A")).toHaveValue(11);
    expect(within(dialog).getByLabelText("Score B")).toHaveValue(7);
    expect(state.actor.applyTournamentCommand).not.toHaveBeenCalled();
  });

  it("shows opening participant controls and excludes players already occupying another direct slot", async () => {
    const user = userEvent.setup();
    const ready = readyRoom();
    const reserve: TournamentPlayer = {
      ...player(5n, "Vako"),
      status: TournamentPlayerStatus.waiting,
      currentMatchId: undefined,
      table: undefined,
    };
    const initial = { ...ready, players: [...ready.players, reserve] };
    state.actor.getTournamentState.mockResolvedValue(initial);
    saveStates({
      ...initial,
      matches: initial.matches.map((item) =>
        item.id === 1n
          ? {
              ...item,
              sourceA: { __kind__: "player", player: 5n },
              playerA: 5n,
              manualOverride: true,
            }
          : item,
      ),
    });
    renderRoom();
    await user.click(await screen.findByTestId("match.card.1"));
    let dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Edit match players")).toBeVisible();
    const sideA = within(dialog).getByLabelText("Player A slot");
    const sideB = within(dialog).getByLabelText("Player B slot");
    expect(sideA.closest("details")).toBeNull();
    expect(sideB.closest("details")).toBeNull();
    expect(sideA).toBeEnabled();
    expect(sideB).toBeEnabled();
    for (const select of [sideA, sideB]) {
      const options = within(select).getAllByRole("option");
      expect(options.map((option) => option.getAttribute("value"))).toEqual([
        "",
        "1",
        "2",
        "5",
      ]);
      expect(within(select).queryByRole("option", { name: /Ana/ })).toBeNull();
      expect(
        within(select).queryByRole("option", { name: /Davit/ }),
      ).toBeNull();
    }
    expect(
      within(sideA).getByRole("option", { name: /Giorgi/ }),
    ).toBeDisabled();
    fireEvent.change(sideA, { target: { value: "2" } });
    expect(
      within(dialog).getByRole("button", { name: "Change matchup" }),
    ).toBeDisabled();
    await user.selectOptions(sideA, "5");
    await user.click(
      within(dialog).getByRole("button", { name: "Change matchup" }),
    );
    await waitFor(() =>
      expect(
        state.actor.applyTournamentCommand,
      ).toHaveBeenCalledExactlyOnceWith(1n, {
        __kind__: "setMatchPlayers",
        setMatchPlayers: { matchId: 1n, playerA: 5n, playerB: 2n },
      } satisfies TournamentCommand),
    );
    dialog = screen.getByRole("dialog");
    expect(
      await within(dialog).findByRole("button", { name: "Edit Vako" }),
    ).toBeVisible();
    expect(within(dialog).getByLabelText("Player A slot")).toHaveValue("5");
    expect(within(dialog).getByLabelText("Player B slot")).toHaveValue("2");
  });

  it("finishes a ready match with scores 999 and 0 and rejects scores above the limit", async () => {
    const user = userEvent.setup();
    state.actor.getTournamentState.mockResolvedValue(readyRoom());
    saveStates(completedRoom(999n, 0n));
    renderRoom();
    await user.click(await screen.findByTestId("match.card.1"));
    const dialog = screen.getByRole("dialog");
    const scoreA = within(dialog).getByLabelText("Score A");
    const scoreB = within(dialog).getByLabelText("Score B");
    await user.type(scoreA, "1000");
    await user.type(scoreB, "0");
    // Exercise the custom validation independently of the browser's native
    // max constraint, then submit a valid result through the visible button.
    fireEvent.submit(scoreA.closest("form")!);
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Scores must be at most 999.",
    );
    expect(state.actor.applyTournamentCommand).not.toHaveBeenCalled();
    await user.clear(scoreA);
    await user.type(scoreA, "999");
    await user.click(
      within(dialog).getByRole("button", {
        name: "Save result & finish match",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(state.actor.applyTournamentCommand).toHaveBeenCalledExactlyOnceWith(
      1n,
      {
        __kind__: "recordResult",
        recordResult: { matchId: 1n, scoreA: 999n, scoreB: 0n },
      } satisfies TournamentCommand,
    );
  });

  it.each(["playing", "completed"])(
    "requires a confirmed reset before changing a %s pairing and returns to that match",
    async (status) => {
      const user = userEvent.setup();
      state.actor.getTournamentState.mockResolvedValue(
        status === "playing" ? room() : completedRoom(),
      );
      saveStates(readyRoom());
      renderRoom();
      await user.click(await screen.findByTestId("match.card.1"));
      let dialog = screen.getByRole("dialog");
      expect(within(dialog).getByLabelText("Player A slot")).toBeDisabled();
      expect(within(dialog).getByLabelText("Player B slot")).toBeDisabled();
      await user.click(
        within(dialog).getByRole("button", {
          name: "Reset match to edit players",
        }),
      );
      dialog = screen.getByRole("dialog");
      expect(
        within(dialog).getByRole("heading", { name: "Reset this result?" }),
      ).toBeVisible();
      expect(state.actor.applyTournamentCommand).not.toHaveBeenCalled();
      await user.click(
        within(dialog).getByRole("button", { name: "Confirm reset" }),
      );
      await waitFor(() =>
        expect(
          state.actor.applyTournamentCommand,
        ).toHaveBeenCalledExactlyOnceWith(1n, {
          __kind__: "resetMatch",
          resetMatch: { matchId: 1n, cascade: false },
        } satisfies TournamentCommand),
      );
      dialog = screen.getByRole("dialog");
      await waitFor(() =>
        expect(within(dialog).getByLabelText("Player A slot")).toBeEnabled(),
      );
      expect(
        within(dialog).getByRole("heading", { name: "Match W1.1" }),
      ).toBeVisible();
      expect(within(dialog).getByLabelText("Player B slot")).toBeEnabled();
      expect(within(dialog).getByLabelText("Score A")).toHaveValue(null);
      expect(within(dialog).getByLabelText("Score B")).toHaveValue(null);
    },
  );

  it("retains safe same-round swaps instead of replacing later-round participants directly", async () => {
    const user = userEvent.setup();
    const later = readyRoom({
      matches: [
        match(1n, {
          round: 2n,
          sourceA: { __kind__: "winner", winner: 10n },
          sourceB: { __kind__: "winner", winner: 11n },
        }),
        match(2n, {
          round: 2n,
          sourceA: { __kind__: "winner", winner: 12n },
          sourceB: { __kind__: "winner", winner: 13n },
        }),
      ],
    });
    state.actor.getTournamentState.mockResolvedValue(later);
    saveStates(later);
    renderRoom();
    await user.click(await screen.findByTestId("match.card.1"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Player A slot")).toBeDisabled();
    expect(within(dialog).getByLabelText("Player B slot")).toBeDisabled();
    expect(
      within(dialog).getByRole("button", { name: "Change matchup" }),
    ).toBeDisabled();
    await user.selectOptions(within(dialog).getByLabelText("Other match"), "2");
    await user.selectOptions(
      within(dialog).getByLabelText("This match slot"),
      "a",
    );
    await user.selectOptions(
      within(dialog).getByLabelText("Other match slot"),
      "b",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Swap players" }),
    );
    await waitFor(() =>
      expect(
        state.actor.applyTournamentCommand,
      ).toHaveBeenCalledExactlyOnceWith(1n, {
        __kind__: "swapPlayers",
        swapPlayers: {
          firstMatchId: 1n,
          firstSlot: TournamentSlot.a,
          secondMatchId: 2n,
          secondSlot: TournamentSlot.b,
        },
      } satisfies TournamentCommand),
    );
    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it.each(["Save player", "Back to match"])(
    "keeps an unsaved score draft after participant editing with %s",
    async (finish) => {
      const user = userEvent.setup();
      const original = room();
      saveStates({
        ...original,
        players: original.players.map((item) =>
          item.id === 1n ? { ...item, name: "Nina" } : item,
        ),
      });
      renderRoom();
      await user.click(await screen.findByTestId("match.card.1"));
      let dialog = screen.getByRole("dialog");
      await user.type(within(dialog).getByLabelText("Score A"), "13");
      await user.type(within(dialog).getByLabelText("Score B"), "8");
      await user.click(
        within(dialog).getByRole("button", { name: "Edit Nino" }),
      );
      dialog = screen.getByRole("dialog");
      const name = within(dialog).getByLabelText("Player name");
      await user.clear(name);
      await user.type(name, "Nina");
      await user.click(within(dialog).getByRole("button", { name: finish }));
      dialog = screen.getByRole("dialog");
      expect(
        await within(dialog).findByRole("heading", { name: "Match W1.1" }),
      ).toBeVisible();
      expect(await within(dialog).findByLabelText("Score A")).toHaveValue(13);
      expect(within(dialog).getByLabelText("Score A")).toBeVisible();
      expect(within(dialog).getByLabelText("Score B")).toHaveValue(8);
      if (finish === "Save player") {
        expect(
          state.actor.applyTournamentCommand,
        ).toHaveBeenCalledExactlyOnceWith(1n, {
          __kind__: "editPlayer",
          editPlayer: { playerId: 1n, name: "Nina", skillLevel: 2n },
        } satisfies TournamentCommand);
      } else {
        expect(state.actor.applyTournamentCommand).not.toHaveBeenCalled();
      }
    },
  );
});
