import {
  type GlobalPlayerView,
  TournamentElimination,
  TournamentFormat,
  TournamentPlayerStatus,
  type TournamentState,
  TournamentStatus,
} from "@/backend";
import { PlayerIdentity } from "@/components/players/PlayerIdentity";
import { SharedPlayersDirectory } from "@/components/players/SharedPlayersDirectory";
import { MatchCard } from "@/components/tournaments/MatchCard";
import { MatchesPanel } from "@/components/tournaments/MatchesPanel";
import { PlayersPanel } from "@/components/tournaments/PlayersPanel";
import { StandardView } from "@/components/tournaments/StandardView";
import { PLAYERS_QUERY_KEY } from "@/services/players";
import { normalizeTournamentState } from "@/services/tournament-manager";
import type {
  TournamentManagerView,
  TournamentMatchView,
  TournamentPlayerView,
} from "@/types/tournament-manager";
import { Principal } from "@icp-sdk/core/principal";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ actor: { listPlayers: vi.fn() } }));
vi.mock("@caffeineai/core-infrastructure", () => ({
  useActor: () => ({ actor: state.actor, isFetching: false }),
}));

const memberId = Principal.fromUint8Array(new Uint8Array([1, 2, 3]));
const anotherMemberId = Principal.fromUint8Array(new Uint8Array([4, 5, 6]));
const photo = "https://t.me/i/userpic/320/nino.jpg";
const nextPhoto = "https://t.me/i/userpic/320/nino-new.jpg";
const queuedPhoto = "https://t.me/i/userpic/320/tako.jpg";

function player(
  id: bigint,
  name: string,
  extra: Partial<TournamentPlayerView> = {},
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
    ...extra,
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
    status: "playing",
    manualOverride: false,
    prioritized: false,
    ...extra,
  };
}

function room(): TournamentManagerView {
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
    tableCount: 1,
    started: true,
    generated: true,
    complete: false,
    canChangeFormat: false,
    players: [
      player(1n, "Nino", { userId: memberId, avatarUrl: photo }),
      player(2n, "Giorgi"),
      player(3n, "Tako", { userId: anotherMemberId, avatarUrl: queuedPhoto }),
    ],
    matches: [
      match(1n, { table: 1 }),
      match(2n, {
        status: "ready",
        playerAId: 3n,
        sourceA: { kind: "player", id: 3n },
      }),
    ],
    nextMatches: [2n],
    waitingQueue: [3n],
    tables: [{ number: 1, status: "playing", matchId: 1n }],
    history: [],
    canUndo: false,
    undoCount: 0,
  };
}

function sharedPlayer(
  id: bigint,
  extra: Partial<GlobalPlayerView> = {},
): GlobalPlayerView {
  return {
    id,
    name: "Nino",
    skillLevel: 2n,
    createdAt: 0n,
    updatedAt: 0n,
    ...extra,
  };
}

beforeEach(() => vi.resetAllMocks());

describe("linked player avatars", () => {
  it("retains the linked member and Telegram photo when normalizing canister state", () => {
    const raw: TournamentState = {
      tournamentId: 1n,
      elimination: TournamentElimination.doubleElimination,
      tableCount: 1n,
      started: false,
      updatedAt: 0n,
      matches: [],
      tables: [],
      history: [],
      canUndo: false,
      waitingQueue: [1n, 2n],
      nextMatches: [],
      players: [
        {
          id: 1n,
          globalPlayerId: 10n,
          userId: memberId,
          avatarUrl: photo,
          name: "Nino",
          skillLevel: 2n,
          registrationNumber: 1n,
          registeredAt: 0n,
          status: TournamentPlayerStatus.waiting,
          losses: 0n,
        },
        {
          id: 2n,
          name: "Nino",
          skillLevel: 2n,
          registrationNumber: 2n,
          registeredAt: 0n,
          status: TournamentPlayerStatus.waiting,
          losses: 0n,
        },
      ],
    };
    const normalized = normalizeTournamentState(raw, room().tournament);
    expect(normalized.players[0]).toMatchObject({
      globalPlayerId: 10n,
      userId: memberId,
      avatarUrl: photo,
    });
    expect(normalized.players[1].userId).toBeUndefined();
    expect(normalized.players[1].avatarUrl).toBeUndefined();
  });

  it("updates the shared DaisyUI avatar on relinking and removes the old photo on unlink", () => {
    const linked = player(1n, "Nino", { userId: memberId, avatarUrl: photo });
    const page = render(<PlayerIdentity player={linked} />);
    expect(page.container.querySelector("img")).toHaveAttribute("src", photo);
    expect(page.container.querySelector("img")).toHaveAttribute("alt", "");
    expect(page.container.querySelector(".avatar")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    page.rerender(
      <PlayerIdentity player={{ ...linked, avatarUrl: nextPhoto }} />,
    );
    expect(page.container.querySelector("img")).toHaveAttribute(
      "src",
      nextPhoto,
    );
    page.rerender(
      <PlayerIdentity player={{ ...linked, avatarUrl: undefined }} />,
    );
    expect(page.container.querySelector("img")).toBeNull();
    expect(page.container.querySelector(".avatar-placeholder")).toBeTruthy();
    page.rerender(<PlayerIdentity player={player(1n, "Nino")} />);
    expect(page.container.querySelector(".avatar")).toBeNull();
    expect(screen.getByText("Nino")).toBeVisible();
  });

  it("keeps directory photos tied to member links when players have identical names and cache updates", async () => {
    const linked = sharedPlayer(1n, { userId: memberId, avatarUrl: photo });
    const unlinked = sharedPlayer(2n);
    state.actor.listPlayers.mockResolvedValue([linked, unlinked]);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    const page = render(
      <QueryClientProvider client={client}>
        <SharedPlayersDirectory isAdmin={false} />
      </QueryClientProvider>,
    );
    const rows = await screen.findAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelector("img")).toHaveAttribute("src", photo);
    expect(rows[1].querySelector(".avatar")).toBeNull();
    expect(within(rows[0]).getByText("Linked to a member")).toBeVisible();
    act(() => {
      client.setQueryData(PLAYERS_QUERY_KEY, [
        { ...linked, avatarUrl: nextPhoto },
        unlinked,
      ]);
    });
    await waitFor(() =>
      expect(rows[0].querySelector("img")).toHaveAttribute("src", nextPhoto),
    );
    act(() => {
      client.setQueryData(PLAYERS_QUERY_KEY, [
        { ...linked, userId: undefined, avatarUrl: undefined },
        unlinked,
      ]);
    });
    await waitFor(() => expect(page.container.querySelector("img")).toBeNull());
    expect(screen.queryByText("Linked to a member")).toBeNull();
    page.unmount();
    client.clear();
  });

  it.each([false, true])(
    "shows the linked avatar in match cards (compact: %s)",
    (compact) => {
      const view = room();
      const page = render(
        <MatchCard
          match={view.matches[0]}
          players={view.players}
          matches={view.matches}
          onSelect={vi.fn()}
          compact={compact}
        />,
      );
      expect(page.container.querySelectorAll("img")).toHaveLength(1);
      expect(page.container.querySelector("img")).toHaveAttribute("src", photo);
      expect(screen.getByRole("button")).toHaveAccessibleName(/Nino.*Giorgi/);
    },
  );

  it("shows each linked participant's photo in the match table", () => {
    const page = render(<MatchesPanel view={room()} onSelect={vi.fn()} />);
    const firstMatch = screen.getByTestId("match.row.1");
    const nextMatch = screen.getByTestId("match.row.2");
    expect(firstMatch.querySelector("img")).toHaveAttribute("src", photo);
    expect(nextMatch.querySelector("img")).toHaveAttribute("src", queuedPhoto);
    expect(page.container.querySelectorAll("img")).toHaveLength(2);
  });

  it("shows linked photos beside the corresponding tournament player names", () => {
    const page = render(
      <PlayersPanel
        view={room()}
        isAdmin={false}
        pending={false}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
        onPrioritize={vi.fn()}
        onMove={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("rowheader", { name: "Nino" }).querySelector("img"),
    ).toHaveAttribute("src", photo);
    expect(
      screen
        .getByRole("rowheader", { name: "Giorgi" })
        .querySelector(".avatar"),
    ).toBeNull();
    expect(
      screen.getByRole("rowheader", { name: "Tako" }).querySelector("img"),
    ).toHaveAttribute("src", queuedPhoto);
    expect(page.container.querySelectorAll("img")).toHaveLength(2);
  });

  it("shows photos on the floor, in the next matches and beside waiting players", () => {
    render(
      <StandardView
        view={room()}
        isAdmin={false}
        pending={false}
        onSelect={vi.fn()}
        onAssign={vi.fn()}
      />,
    );
    expect(
      screen.getByTestId("tournament.tables").querySelector("img"),
    ).toHaveAttribute("src", photo);
    expect(
      screen.getByTestId("tournament.next_matches").querySelector("img"),
    ).toHaveAttribute("src", queuedPhoto);
    expect(
      screen.getByTestId("tournament.waiting_queue").querySelector("img"),
    ).toHaveAttribute("src", queuedPhoto);
  });
});
