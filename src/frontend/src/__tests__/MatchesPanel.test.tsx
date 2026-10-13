import { TournamentFormat, TournamentStatus } from "@/backend";
import { MatchesPanel } from "@/components/tournaments/MatchesPanel";
import type {
  MatchStatus,
  TournamentManagerView,
  TournamentMatchView,
  TournamentPlayerView,
} from "@/types/tournament-manager";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

function player(id: bigint, name: string): TournamentPlayerView {
  return {
    id,
    name,
    skill: 2,
    registrationNumber: id,
    registeredAt: 0n,
    status: "ready",
    losses: 0,
    manualOverride: false,
  };
}

function match(
  id: bigint,
  extra: Partial<TournamentMatchView> = {},
): TournamentMatchView {
  return {
    id,
    bracket: "winners",
    round: 1,
    position: Number(id),
    sourceA: { kind: "player", id: 1n },
    sourceB: { kind: "player", id: 2n },
    playerAId: 1n,
    playerBId: 2n,
    status: "ready",
    manualOverride: false,
    prioritized: false,
    ...extra,
  };
}

function room(matches?: TournamentMatchView[]): TournamentManagerView {
  return {
    tournament: {
      id: 1n,
      title: "Warehouse Cup",
      description: "",
      venue: "ChillPong",
      startsAt: 0n,
      format: TournamentFormat.singles,
      capacity: 8n,
      status: TournamentStatus.live,
      createdAt: 0n,
      updatedAt: 0n,
    },
    elimination: "double",
    tableCount: 2,
    started: true,
    generated: true,
    complete: false,
    canChangeFormat: false,
    players: [player(1n, "Nino"), player(2n, "Giorgi")],
    matches: matches ?? [
      match(10n, {
        round: 2,
        position: 1,
        playerAId: undefined,
        playerBId: undefined,
        sourceA: { kind: "winner", id: 1n },
        sourceB: { kind: "winner", id: 2n },
        status: "pending",
      }),
      match(1n, { status: "completed", table: 4, scoreA: 0, scoreB: 11 }),
      match(2n, { status: "playing", table: 1 }),
      match(3n, { bracket: "losers", status: "ready", table: 2 }),
      match(4n, {
        bracket: "losers",
        round: 2,
        playerBId: undefined,
        sourceB: { kind: "bye" },
        status: "bye",
      }),
      match(5n, {
        bracket: "resetFinal",
        round: 1,
        playerAId: undefined,
        playerBId: undefined,
        sourceA: { kind: "loser", id: 3n },
        sourceB: { kind: "empty" },
        status: "void",
      }),
    ],
    nextMatches: [3n],
    waitingQueue: [],
    tables: [
      { number: 1, status: "playing", matchId: 2n },
      { number: 2, status: "waiting", matchId: 3n },
    ],
    history: [],
    canUndo: false,
    undoCount: 0,
  };
}

function visibleIds() {
  return within(screen.getByTestId("tournament.matches_table"))
    .getAllByTestId(/^match\.row\./)
    .map((row) => row.getAttribute("data-ocid"));
}

describe("tournament match list", () => {
  it("includes unresolved, completed, bye and void matches in bracket order, keeping a zero score", () => {
    render(<MatchesPanel view={room()} onSelect={vi.fn()} />);
    expect(visibleIds()).toEqual([
      "match.row.10",
      "match.row.1",
      "match.row.2",
      "match.row.3",
      "match.row.4",
      "match.row.5",
    ]);
    expect(screen.getByTestId("match.row.10")).toHaveTextContent(
      "Winner / W1.1",
    );
    expect(screen.getByTestId("match.row.5")).toHaveTextContent("Loser / L1.3");
    expect(screen.getByTestId("match.row.5")).toHaveTextContent(
      "Awaiting player",
    );
    expect(screen.getByTestId("match.row.4")).toHaveTextContent("BYE");
    expect(screen.getByTestId("match.row.1")).toHaveTextContent(/0\s*:\s*11/);
    expect(screen.getByText("6 of 6 matches")).toBeVisible();
    expect(screen.getByLabelText("Match sort order")).toHaveValue("bracket");
  });

  it("searches player names, match labels, IDs and unresolved sources without case or whitespace sensitivity", async () => {
    const user = userEvent.setup();
    render(<MatchesPanel view={room()} onSelect={vi.fn()} />);
    const search = screen.getByRole("searchbox", {
      name: "Search tournament matches",
    });
    await user.type(search, "  nINo  ");
    expect(visibleIds()).toEqual([
      "match.row.1",
      "match.row.2",
      "match.row.3",
      "match.row.4",
    ]);
    await user.clear(search);
    await user.type(search, "M10");
    expect(visibleIds()).toEqual(["match.row.10"]);
    await user.clear(search);
    await user.type(search, " RF1.5 ");
    expect(visibleIds()).toEqual(["match.row.5"]);
    await user.clear(search);
    await user.type(search, "winner / w1.2");
    expect(visibleIds()).toEqual(["match.row.10"]);
    await user.clear(search);
    await user.type(search, "not a participant");
    expect(screen.queryByTestId("tournament.matches_table")).toBeNull();
    expect(screen.getByText("0 of 6 matches")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Reset filters & sort" }),
    );
    expect(search).toHaveValue("");
    expect(visibleIds()).toHaveLength(6);
  });

  it("combines status, bracket, round and table filters, including historical tables beyond the current count", async () => {
    const user = userEvent.setup();
    render(<MatchesPanel view={room()} onSelect={vi.fn()} />);
    const table = screen.getByLabelText("Match table");
    expect(within(table).getByRole("option", { name: "Table 4" })).toHaveValue(
      "4",
    );
    await user.selectOptions(screen.getByLabelText("Match status"), "ready");
    await user.selectOptions(screen.getByLabelText("Bracket"), "losers");
    await user.selectOptions(screen.getByLabelText("Match round"), "losers:1");
    await user.selectOptions(table, "2");
    expect(visibleIds()).toEqual(["match.row.3"]);
    expect(
      within(screen.getByLabelText("Match round")).queryByRole("option", {
        name: "Winners bracket / R1",
      }),
    ).toBeNull();
    await user.selectOptions(screen.getByLabelText("Bracket"), "winners");
    expect(screen.getByLabelText("Match round")).toHaveValue("all");
    expect(screen.getByText("0 of 6 matches")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Reset filters & sort" }),
    );
    await user.selectOptions(
      screen.getByLabelText("Match status"),
      "completed",
    );
    await user.selectOptions(table, "4");
    expect(visibleIds()).toEqual(["match.row.1"]);
    await user.click(
      screen.getByRole("button", { name: "Reset filters & sort" }),
    );
    await user.selectOptions(table, "none");
    expect(visibleIds()).toEqual([
      "match.row.10",
      "match.row.4",
      "match.row.5",
    ]);
  });

  it("filters every match status and sorts live matches first without changing the saved bracket", async () => {
    const user = userEvent.setup();
    const view = room();
    const savedMatches = structuredClone(view.matches);
    render(<MatchesPanel view={view} onSelect={vi.fn()} />);
    const statuses: Array<[MatchStatus, string]> = [
      ["pending", "10"],
      ["ready", "3"],
      ["playing", "2"],
      ["completed", "1"],
      ["bye", "4"],
      ["void", "5"],
    ];
    for (const [status, id] of statuses) {
      await user.selectOptions(screen.getByLabelText("Match status"), status);
      expect(visibleIds()).toEqual([`match.row.${id}`]);
    }
    await user.selectOptions(screen.getByLabelText("Match status"), "all");
    await user.selectOptions(
      screen.getByLabelText("Match sort order"),
      "status",
    );
    expect(visibleIds()).toEqual([
      "match.row.2",
      "match.row.3",
      "match.row.10",
      "match.row.1",
      "match.row.4",
      "match.row.5",
    ]);
    await user.click(
      screen.getByRole("button", { name: "Reset filters & sort" }),
    );
    expect(visibleIds()[0]).toBe("match.row.10");
    expect(view.matches).toEqual(savedMatches);
  });

  it("opens the clicked row once and supports keyboard activation of its match button", async () => {
    const user = userEvent.setup();
    const view = room();
    const onSelect = vi.fn();
    render(<MatchesPanel view={view} onSelect={onSelect} />);
    await user.click(
      within(screen.getByTestId("match.row.1")).getByText("Giorgi"),
    );
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(view.matches[1]);
    const row = screen.getByTestId("match.row.3");
    row.focus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect).toHaveBeenLastCalledWith(view.matches[3]);
    await user.keyboard(" ");
    expect(onSelect).toHaveBeenCalledTimes(3);
    expect(onSelect).toHaveBeenLastCalledWith(view.matches[3]);
    const button = screen.getByRole("button", {
      name: "Open match W1.2 / M2: Nino vs Giorgi",
    });
    button.focus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(4);
    expect(onSelect).toHaveBeenLastCalledWith(view.matches[2]);
  });

  it("paginates a full bracket, returns to page one after filtering, and clamps after state changes", async () => {
    const user = userEvent.setup();
    const view = room(
      Array.from({ length: 27 }, (_, index) => match(BigInt(index + 1))),
    );
    const onSelect = vi.fn();
    const { rerender } = render(
      <MatchesPanel view={view} onSelect={onSelect} />,
    );
    expect(visibleIds()).toHaveLength(25);
    expect(screen.getByText("Page 1 of 2")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Previous matches page" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Next matches page" }));
    expect(visibleIds()).toEqual(["match.row.26", "match.row.27"]);
    expect(screen.getByText("Page 2 of 2")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Next matches page" }),
    ).toBeDisabled();
    await user.type(screen.getByRole("searchbox"), "M1");
    expect(visibleIds()).toHaveLength(11);
    expect(visibleIds()[0]).toBe("match.row.1");
    await user.click(
      screen.getByRole("button", { name: "Reset filters & sort" }),
    );
    await user.click(screen.getByRole("button", { name: "Next matches page" }));
    rerender(
      <MatchesPanel
        view={{ ...view, matches: view.matches.slice(0, 3) }}
        onSelect={onSelect}
      />,
    );
    expect(visibleIds()).toEqual(["match.row.1", "match.row.2", "match.row.3"]);
    expect(screen.getByText("3 of 3 matches")).toBeVisible();
  });

  it("renders an empty tournament without match actions or pagination", () => {
    render(<MatchesPanel view={room([])} onSelect={vi.fn()} />);
    expect(screen.getByRole("heading", { name: /Matches/ })).toBeVisible();
    expect(screen.getByText("0 of 0 matches")).toBeVisible();
    expect(screen.queryByTestId("tournament.matches_table")).toBeNull();
    expect(screen.queryByRole("button", { name: /Open match/ })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Next matches page" }),
    ).toBeNull();
  });
});
