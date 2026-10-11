import { TournamentFormat, TournamentStatus } from "@/backend";
import { StandardView } from "@/components/tournaments/StandardView";
import { TableAssignment } from "@/components/tournaments/TableAssignment";
import { setLanguage } from "@/i18n";
import type {
  TournamentManagerView,
  TournamentMatchView,
  TournamentPlayerView,
} from "@/types/tournament-manager";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const registeredAt = 1_786_108_800_000_000_000n;

function match(
  id: bigint,
  overrides: Partial<TournamentMatchView> = {},
): TournamentMatchView {
  return {
    id,
    bracket: "winners",
    round: 1,
    position: Number(id),
    playerAId: id * 2n - 1n,
    playerBId: id * 2n,
    sourceA: { kind: "player", id: id * 2n - 1n },
    sourceB: { kind: "player", id: id * 2n },
    status: "ready",
    manualOverride: false,
    prioritized: false,
    ...overrides,
  };
}

function room(): TournamentManagerView {
  const matches = [
    match(1n, { status: "playing", table: 1 }),
    match(2n, { table: 2 }),
    ...[3n, 4n, 5n, 6n, 7n, 8n].map((id) => match(id)),
    match(9n, { status: "completed", table: 4, scoreA: 11, scoreB: 7 }),
    match(10n, { status: "pending" }),
    match(11n, { playerBId: undefined }),
  ];
  const players: TournamentPlayerView[] = matches.flatMap((item) =>
    [item.playerAId, item.playerBId]
      .filter((id): id is bigint => id !== undefined)
      .map((id) => ({
        id,
        name: `${id % 2n ? "First" : "Second"} ${item.id}`,
        skill: 2,
        registrationNumber: id,
        registeredAt,
        status: item.status === "playing" ? "playing" : "ready",
        currentMatchId: item.id,
        table: item.table,
        losses: 0,
        manualOverride: false,
      })),
  );
  return {
    tournament: {
      id: 1n,
      title: "Floor Cup",
      description: "",
      venue: "ChillPong Bar",
      startsAt: registeredAt,
      format: TournamentFormat.singles,
      capacity: 32n,
      status: TournamentStatus.live,
      createdAt: registeredAt,
      updatedAt: registeredAt,
    },
    elimination: "single",
    tableCount: 4,
    started: true,
    generated: true,
    complete: false,
    canChangeFormat: false,
    players,
    matches,
    waitingQueue: [],
    nextMatches: [2n, 3n, 4n, 5n, 6n, 7n, 8n],
    tables: [
      { number: 1, status: "playing", matchId: 1n },
      { number: 2, status: "waiting", matchId: 2n },
      { number: 3, status: "available" },
      { number: 4, status: "finished", matchId: 9n },
    ],
    history: [],
    canUndo: false,
    undoCount: 0,
  };
}

beforeEach(() => {
  setLanguage("en");
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("table assignment", () => {
  it("offers every eligible match, including matches beyond the next five and matches on other tables", () => {
    const view = room();
    render(
      <TableAssignment
        view={view}
        table={view.tables[0]!}
        pending={false}
        onAssign={vi.fn()}
      />,
    );
    const select = screen.getByRole("combobox", { name: "Match for table 1" });
    expect(select).toHaveValue("1");
    expect(within(select).getAllByRole("option")).toHaveLength(9);
    for (const id of [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n]) {
      expect(
        within(select).getByRole("option", {
          name: new RegExp(`First ${id}.*Second ${id}`),
        }),
      ).toHaveValue(id.toString());
    }
    expect(
      within(select).queryByRole("option", { name: /First 9/ }),
    ).toBeNull();
    expect(
      within(select).queryByRole("option", { name: /First 10/ }),
    ).toBeNull();
    expect(
      within(select).queryByRole("option", { name: /First 11/ }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Apply assignment to table 1" }),
    ).toBeDisabled();
  });

  it("replaces an occupied table only after an admin applies their selected match", async () => {
    const user = userEvent.setup();
    const view = room();
    const onAssign = vi.fn();
    render(
      <TableAssignment
        view={view}
        table={view.tables[0]!}
        pending={false}
        onAssign={onAssign}
      />,
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Match for table 1" }),
      "8",
    );
    expect(onAssign).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "The current match returns to ready without a table.",
    );
    const apply = screen.getByRole("button", {
      name: "Apply assignment to table 1",
    });
    expect(apply).toBeEnabled();
    await user.click(apply);
    expect(onAssign).toHaveBeenCalledExactlyOnceWith(8n, 1);
  });

  it("allows a match assigned elsewhere to be selected for the occupied table", async () => {
    const user = userEvent.setup();
    const view = room();
    const onAssign = vi.fn();
    render(
      <TableAssignment
        view={view}
        table={view.tables[0]!}
        pending={false}
        onAssign={onAssign}
      />,
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Match for table 1" }),
      "2",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Table assignments will be exchanged with table 2.",
    );
    await user.click(
      screen.getByRole("button", { name: "Apply assignment to table 1" }),
    );
    expect(onAssign).toHaveBeenCalledExactlyOnceWith(2n, 1);
  });

  it("clears an active assignment using the current match id", async () => {
    const user = userEvent.setup();
    const view = room();
    const onAssign = vi.fn();
    render(
      <TableAssignment
        view={view}
        table={view.tables[0]!}
        pending={false}
        onAssign={onAssign}
      />,
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Match for table 1" }),
      "",
    );
    await user.click(
      screen.getByRole("button", { name: "Apply assignment to table 1" }),
    );
    expect(onAssign).toHaveBeenCalledExactlyOnceWith(1n, undefined);
  });

  it.each([2, 3])(
    "does not clear an empty or finished table but can assign a ready match (index %s)",
    async (tableIndex) => {
      const user = userEvent.setup();
      const view = room();
      const table = view.tables[tableIndex]!;
      const onAssign = vi.fn();
      render(
        <TableAssignment
          view={view}
          table={table}
          pending={false}
          onAssign={onAssign}
        />,
      );
      const select = screen.getByRole("combobox", {
        name: `Match for table ${table.number}`,
      });
      const apply = screen.getByRole("button", {
        name: `Apply assignment to table ${table.number}`,
      });
      expect(select).toHaveValue("");
      expect(apply).toBeDisabled();
      await user.selectOptions(select, "3");
      await user.click(apply);
      expect(onAssign).toHaveBeenCalledExactlyOnceWith(3n, table.number);
    },
  );

  it("disables submission while an organizer command is pending", async () => {
    const user = userEvent.setup();
    const view = room();
    const onAssign = vi.fn();
    const props = { view, table: view.tables[0]!, onAssign };
    const { rerender } = render(<TableAssignment {...props} pending={false} />);
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Match for table 1" }),
      "3",
    );
    rerender(<TableAssignment {...props} pending />);
    const apply = screen.getByRole("button", {
      name: "Apply assignment to table 1",
    });
    expect(apply).toBeDisabled();
    await user.click(apply);
    expect(onAssign).not.toHaveBeenCalled();
  });

  it("refreshes its selected match after the table assignment changes", () => {
    const view = room();
    const props = { pending: false, onAssign: vi.fn() };
    const { rerender } = render(
      <TableAssignment {...props} view={view} table={view.tables[0]!} />,
    );
    const updated: TournamentManagerView = {
      ...view,
      tables: view.tables.map((table) =>
        table.number === 1
          ? { ...table, matchId: 3n, status: "waiting" }
          : table,
      ),
      matches: view.matches.map((item) =>
        item.id === 1n
          ? { ...item, table: undefined, status: "ready" }
          : item.id === 3n
            ? { ...item, table: 1 }
            : item,
      ),
    };
    rerender(
      <TableAssignment {...props} view={updated} table={updated.tables[0]!} />,
    );
    expect(
      screen.getByRole("combobox", { name: "Match for table 1" }),
    ).toHaveValue("3");
    expect(
      screen.getByRole("button", { name: "Apply assignment to table 1" }),
    ).toBeDisabled();
  });

  it("discards a stale choice when that match becomes unavailable", async () => {
    const user = userEvent.setup();
    const view = room();
    const props = { table: view.tables[0]!, pending: false, onAssign: vi.fn() };
    const { rerender } = render(<TableAssignment {...props} view={view} />);
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Match for table 1" }),
      "3",
    );
    const updated: TournamentManagerView = {
      ...view,
      matches: view.matches.map((item) =>
        item.id === 3n ? { ...item, status: "completed" } : item,
      ),
    };
    rerender(<TableAssignment {...props} view={updated} />);
    expect(
      screen.getByRole("combobox", { name: "Match for table 1" }),
    ).toHaveValue("1");
    expect(
      screen.getByRole("button", { name: "Apply assignment to table 1" }),
    ).toBeDisabled();
    expect(props.onAssign).not.toHaveBeenCalled();
  });
});

describe("floor assignment controls", () => {
  it.each([
    ["phone", 390],
    ["desktop", 1280],
  ])(
    "lets admins choose a match for every table on %s",
    async (_device, width) => {
      vi.stubGlobal("innerWidth", width);
      const user = userEvent.setup();
      const onAssign = vi.fn();
      render(
        <StandardView
          view={room()}
          isAdmin
          pending={false}
          onSelect={vi.fn()}
          onAssign={onAssign}
        />,
      );
      const floor = screen.getByTestId("tournament.tables");
      for (const number of [1, 2, 3, 4]) {
        expect(
          within(floor).getByRole("combobox", {
            name: `Match for table ${number}`,
          }),
        ).toBeVisible();
        expect(
          within(floor).getByRole("button", {
            name: `Apply assignment to table ${number}`,
          }),
        ).toBeVisible();
      }
      await user.selectOptions(
        within(floor).getByRole("combobox", { name: "Match for table 3" }),
        "8",
      );
      await user.click(
        within(floor).getByRole("button", {
          name: "Apply assignment to table 3",
        }),
      );
      expect(onAssign).toHaveBeenCalledExactlyOnceWith(8n, 3);
    },
  );

  it("keeps spectator floor cards read-only", () => {
    render(
      <StandardView
        view={room()}
        isAdmin={false}
        pending={false}
        onSelect={vi.fn()}
        onAssign={vi.fn()}
      />,
    );
    const floor = screen.getByTestId("tournament.tables");
    expect(within(floor).queryByRole("combobox")).toBeNull();
    expect(
      within(floor).queryByRole("button", {
        name: /Apply assignment|Assign next match/,
      }),
    ).toBeNull();
    expect(within(floor).getByTestId("match.card.1")).toBeVisible();
  });
});
