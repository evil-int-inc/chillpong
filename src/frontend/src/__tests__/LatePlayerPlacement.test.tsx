import { TournamentFormat, TournamentStatus } from "@/backend";
import { OrganizerDialogs } from "@/components/tournaments/OrganizerDialogs";
import {
  type TournamentManagerView,
  type TournamentMatchView,
  playerMovement,
} from "@/types/tournament-manager";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

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
    sourceB: { kind: "bye" },
    playerAId: 1n,
    status: "bye",
    manualOverride: false,
    prioritized: false,
    ...extra,
  };
}
function room(): TournamentManagerView {
  return {
    tournament: {
      id: 3n,
      title: "Late arrivals",
      description: "",
      venue: "ChillPong",
      startsAt: 1n,
      format: TournamentFormat.singles,
      status: TournamentStatus.live,
      capacity: 40n,
      createdAt: 1n,
      updatedAt: 1n,
    },
    elimination: "double",
    tableCount: 3,
    started: true,
    generated: true,
    complete: false,
    canChangeFormat: false,
    players: Array.from({ length: 53 }, (_, index) => ({
      id: BigInt(index + 1),
      name: `Player ${index + 1}`,
      skill: 2,
      registrationNumber: BigInt(index + 1),
      registeredAt: 1n,
      status: "waiting",
      losses: 0,
      manualOverride: false,
    })),
    // A reduced, anonymous version of the live incident: old BYEs feed scored
    // games, while a later round remains available for a new qualification match.
    matches: [
      match(15n),
      match(16n, { sourceA: { kind: "player", id: 2n }, playerAId: 2n }),
      match(11n, { status: "completed" }),
      match(12n, { status: "completed" }),
      match(38n, {
        round: 2,
        sourceA: { kind: "winner", id: 11n },
        sourceB: { kind: "winner", id: 12n },
        playerAId: 3n,
        playerBId: 4n,
        status: "ready",
      }),
      match(40n, {
        round: 2,
        sourceA: { kind: "winner", id: 15n },
        sourceB: { kind: "winner", id: 16n },
        status: "completed",
      }),
      match(63n, {
        round: 3,
        sourceA: { kind: "winner", id: 38n },
        sourceB: { kind: "winner", id: 40n },
        status: "pending",
      }),
    ],
    waitingQueue: [53n],
    nextMatches: [38n],
    tables: [],
    history: [],
    canUndo: false,
    undoCount: 0,
  };
}
function modal(view: TournamentManagerView, error: string | null = null) {
  const onAction = vi.fn();
  render(
    <OrganizerDialogs
      view={view}
      modal={{ kind: "move", player: view.players[52] }}
      isAdmin
      pending={false}
      error={error}
      onAction={onAction}
      onClose={vi.fn()}
      onOpen={vi.fn()}
    />,
  );
  return onAction;
}
afterEach(() => vi.unstubAllGlobals());

describe("late player placement in an ongoing tournament", () => {
  it.each([390, 1440])(
    "defaults to a safe later round instead of a locked BYE at %s px",
    async (width) => {
      vi.stubGlobal("innerWidth", width);
      const user = userEvent.setup();
      const onAction = modal(room());
      const dialog = within(screen.getByRole("dialog"));
      expect(
        dialog.getByText(
          "Already registered in this tournament. Choose a match to place this player in the bracket.",
        ),
      ).toBeVisible();
      const destination = dialog.getByLabelText("Destination match");
      expect(destination).toHaveValue("38");
      expect(
        within(destination)
          .getAllByRole("option")
          .map((option) => option.getAttribute("value")),
      ).toEqual(["38", "63"]);
      await user.click(dialog.getByRole("button", { name: "Place player" }));
      expect(onAction).toHaveBeenCalledExactlyOnceWith({
        kind: "placePlayer",
        playerId: 53n,
        matchId: 38n,
        slot: "a",
      });
    },
  );

  it.each(["playing", "completed"] as const)(
    "protects ancestors of %s losers-bracket matches as well as winners-bracket matches",
    (status) => {
      const view = room();
      view.matches = view.matches.filter(
        (item) => item.id !== 40n && item.id !== 63n,
      );
      view.matches.push(
        match(87n, {
          bracket: "losers",
          sourceA: { kind: "loser", id: 15n },
          status,
        }),
      );
      const targets = playerMovement(view, view.players[52]).targets.map(
        (item) => item.id,
      );
      expect(targets).not.toContain(15n);
      expect(targets).toContain(16n);
      expect(targets).toContain(38n);
    },
  );

  it("retains untouched BYEs and later matches whose earlier results have already been scored", () => {
    const view = room();
    view.matches.find((item) => item.id === 40n)!.status = "pending";
    expect(
      playerMovement(view, view.players[52]).targets.map((item) => item.id),
    ).toEqual([15n, 16n, 38n, 40n, 63n]);
  });

  it("protects indirect ancestors regardless of match array order", () => {
    const view = room();
    view.matches.push(
      match(100n, {
        bracket: "losers",
        status: "playing",
        sourceA: { kind: "loser", id: 63n },
      }),
    );
    view.matches.reverse();
    expect(playerMovement(view, view.players[52]).targets).toEqual([]);
    modal(view);
    expect(
      screen.getByRole("option", { name: "No safe bracket slots" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Place player" })).toBeDisabled();
  });

  it("keeps placement errors outside the scrolling form and preserves the registered player", () => {
    const view = room();
    modal(
      view,
      "Reset completed or playing dependent matches before changing the bracket",
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      "Reset completed or playing dependent matches",
    );
    expect(alert.closest("footer")).not.toBeNull();
    expect(screen.getByText("Player 53")).toBeVisible();
    expect(screen.getByRole("button", { name: "Place player" })).toBeEnabled();
  });
});
