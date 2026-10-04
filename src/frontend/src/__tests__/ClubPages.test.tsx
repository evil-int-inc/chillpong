import {
  Role,
  type Tournament,
  TournamentFormat,
  type TournamentInput,
  TournamentStatus,
  type User,
  type UserInput,
} from "@/backend";
import { TournamentsPage } from "@/pages/TournamentsPage";
import { UsersPage } from "@/pages/UsersPage";
import { Principal } from "@icp-sdk/core/principal";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  auth: { isAdmin: false },
  actor: {
    listUsers: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    getTournaments: vi.fn(),
    createTournament: vi.fn(),
    updateTournament: vi.fn(),
  },
}));

vi.mock("@caffeineai/core-infrastructure", () => ({
  useActor: () => ({ actor: state.actor, isFetching: false }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => state.auth,
}));

const memberId = Principal.fromUint8Array(new Uint8Array([1, 2, 3]));
const newMemberId = Principal.fromUint8Array(new Uint8Array([4, 5, 6]));
const startsAt = BigInt(Date.parse("2026-10-09T17:00:00Z")) * 1_000_000n;

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: memberId,
    displayName: "Nino",
    username: "nino",
    bio: "Backhand specialist",
    createdAt: startsAt,
    ...overrides,
  };
}

function makeTournament(overrides: Partial<Tournament> = {}): Tournament {
  return {
    id: 1n,
    title: "Warehouse Cup",
    description: "Bring your paddle",
    venue: "ChillPong Bar",
    startsAt,
    format: TournamentFormat.singles,
    capacity: 16n,
    status: TournamentStatus.upcoming,
    createdAt: startsAt,
    updatedAt: startsAt,
    ...overrides,
  };
}

function renderPage(page: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{page}</QueryClientProvider>,
  );
}

beforeEach(() => {
  state.auth.isAdmin = false;
  for (const method of Object.values(state.actor)) method.mockReset();
  state.actor.listUsers.mockResolvedValue([makeUser()]);
  state.actor.getTournaments.mockResolvedValue([makeTournament()]);
});

describe("public club directory and tournament board", () => {
  it("lets visitors browse users without creating or editing them", async () => {
    renderPage(<UsersPage />);

    expect(await screen.findByRole("heading", { name: "Nino" })).toBeVisible();
    expect(screen.getByText("@nino")).toBeVisible();
    expect(screen.getByText("Backhand specialist")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Add user" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Edit/ })).toBeNull();
    expect(state.actor.createUser).not.toHaveBeenCalled();
    expect(state.actor.updateUser).not.toHaveBeenCalled();
  });

  it("lets visitors read tournament details without changing the tournament", async () => {
    const user = userEvent.setup();
    renderPage(<TournamentsPage />);

    await user.click(
      await screen.findByRole("button", { name: "Details for Warehouse Cup" }),
    );
    const detail = screen.getByRole("dialog");
    expect(within(detail).getByText("Bring your paddle")).toBeVisible();
    expect(within(detail).getByText("16 players maximum")).toBeVisible();
    expect(within(detail).getByText(/21:00 \/ Tbilisi/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "New tournament" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Edit/ })).toBeNull();
    expect(state.actor.createTournament).not.toHaveBeenCalled();
    expect(state.actor.updateTournament).not.toHaveBeenCalled();
  });

  it("combines member search and admin filtering, and can reset a missed search", async () => {
    const user = userEvent.setup();
    state.actor.listUsers.mockResolvedValue([
      makeUser(),
      makeUser({
        id: newMemberId,
        displayName: "Giorgi",
        username: "giorgi",
        bio: "The crew",
        role: Role.admin,
      }),
    ]);
    renderPage(<UsersPage />);
    await screen.findByRole("heading", { name: "Nino" });

    await user.click(screen.getByRole("button", { name: /Admins/ }));
    expect(screen.queryByRole("heading", { name: "Nino" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Giorgi" })).toBeVisible();
    await user.type(
      screen.getByRole("searchbox", { name: "Search users" }),
      "missing",
    );
    expect(screen.getByText("No matches.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(screen.getByRole("heading", { name: "Nino" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Giorgi" })).toBeVisible();
  });

  it("combines tournament status and venue search without exposing unrelated events", async () => {
    const user = userEvent.setup();
    state.actor.getTournaments.mockResolvedValue([
      makeTournament(),
      makeTournament({
        id: 2n,
        title: "Live Rally",
        venue: "Basement Bar",
        status: TournamentStatus.live,
      }),
      makeTournament({
        id: 3n,
        title: "Last Night",
        status: TournamentStatus.completed,
      }),
    ]);
    renderPage(<TournamentsPage />);
    await screen.findByRole("button", { name: "Warehouse Cup" });

    await user.click(screen.getByRole("button", { name: "Live now" }));
    expect(screen.getByRole("button", { name: "Live Rally" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Warehouse Cup" })).toBeNull();
    await user.type(
      screen.getByRole("searchbox", { name: "Search tournaments" }),
      "ChillPong",
    );
    expect(screen.getByText("No games in this corner.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(screen.getByRole("button", { name: "Warehouse Cup" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Last Night" })).toBeVisible();
  });

  it.each([
    {
      name: "users",
      page: <UsersPage />,
      method: state.actor.listUsers,
      message: "The lineup starts here.",
    },
    {
      name: "tournaments",
      page: <TournamentsPage />,
      method: state.actor.getTournaments,
      message: "The next night is loading.",
    },
  ])(
    "shows the $name empty state after a successful empty query",
    async ({ page, method, message }) => {
      method.mockResolvedValue([]);
      renderPage(page);
      expect(await screen.findByText(message)).toBeVisible();
      expect(screen.queryByRole("alert")).toBeNull();
    },
  );

  it.each([
    {
      name: "users",
      page: <UsersPage />,
      method: state.actor.listUsers,
      message: "Directory unavailable.",
    },
    {
      name: "tournaments",
      page: <TournamentsPage />,
      method: state.actor.getTournaments,
      message: "The board is offline.",
    },
  ])(
    "shows a retryable $name query error instead of an empty directory",
    async ({ page, method, message }) => {
      const user = userEvent.setup();
      method
        .mockRejectedValueOnce(new Error("Connection lost"))
        .mockResolvedValue([]);
      renderPage(page);
      expect(await screen.findByRole("alert")).toHaveTextContent(message);
      await user.click(screen.getByRole("button", { name: "Try again" }));
      await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
      expect(method).toHaveBeenCalledTimes(2);
    },
  );
});

describe("administrator editors", () => {
  it("keeps an unchanged legacy handle while editing other member details", async () => {
    const user = userEvent.setup();
    state.auth.isAdmin = true;
    // This uppercase, one-character Unicode handle was accepted by the
    // previous app and must remain editable without a forced rename.
    let member = makeUser({ username: "Ä" });
    state.actor.listUsers.mockImplementation(async () => [member]);
    state.actor.updateUser.mockImplementation(
      async (_id: Principal, input: UserInput) => {
        member = { ...member, ...input };
        return member;
      },
    );
    renderPage(<UsersPage />);
    await user.click(await screen.findByRole("button", { name: "Edit Nino" }));
    const editor = within(screen.getByRole("dialog"));
    expect(editor.getByLabelText(/Username/)).toHaveValue("Ä");
    await user.clear(editor.getByLabelText("Display name"));
    await user.type(editor.getByLabelText("Display name"), "Nino B");
    await user.clear(editor.getByLabelText("Bio / optional"));
    await user.type(editor.getByLabelText("Bio / optional"), "Plays doubles");
    await user.click(editor.getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByRole("heading", { name: "Nino B" }),
    ).toBeVisible();
    expect(screen.getByText("@Ä")).toBeVisible();
    expect(state.actor.updateUser).toHaveBeenCalledWith(memberId, {
      displayName: "Nino B",
      username: "Ä",
      bio: "Plays doubles",
    });
  });

  it("creates and edits a user through the backend without changing the member identity", async () => {
    const user = userEvent.setup();
    state.auth.isAdmin = true;
    const users = [makeUser()];
    state.actor.listUsers.mockImplementation(async () => [...users]);
    state.actor.createUser.mockImplementation(
      async (id: Principal, input: UserInput) => {
        const member = makeUser({ id, ...input });
        users.push(member);
        return member;
      },
    );
    state.actor.updateUser.mockImplementation(
      async (id: Principal, input: UserInput) => {
        const member = makeUser({ id, ...input });
        users.splice(
          users.findIndex((entry) => entry.id.toText() === id.toText()),
          1,
          member,
        );
        return member;
      },
    );
    renderPage(<UsersPage />);
    await screen.findByRole("heading", { name: "Nino" });

    await user.click(screen.getByRole("button", { name: "Add user" }));
    let editor = within(screen.getByRole("dialog"));
    await user.type(
      editor.getByLabelText(/Member principal/),
      newMemberId.toText(),
    );
    await user.type(editor.getByLabelText("Display name"), "  Luka  ");
    await user.type(editor.getByLabelText(/Username/), "  LUKA  ");
    await user.type(
      editor.getByLabelText("Bio / optional"),
      "  Plays doubles  ",
    );
    await user.click(editor.getByRole("button", { name: "Add user" }));

    await screen.findByRole("heading", { name: "Luka" });
    expect(state.actor.createUser).toHaveBeenCalledWith(newMemberId, {
      displayName: "Luka",
      username: "luka",
      bio: "Plays doubles",
    });
    await user.click(screen.getByRole("button", { name: "Edit Luka" }));
    editor = within(screen.getByRole("dialog"));
    expect(editor.getByLabelText(/Member principal/)).toHaveAttribute(
      "readonly",
    );
    await user.clear(editor.getByLabelText("Display name"));
    await user.type(editor.getByLabelText("Display name"), "Luka B");
    await user.click(editor.getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByRole("heading", { name: "Luka B" }),
    ).toBeVisible();
    expect(state.actor.updateUser).toHaveBeenCalledWith(newMemberId, {
      displayName: "Luka B",
      username: "luka",
      bio: "Plays doubles",
    });
  });

  it("creates and edits tournaments with the entered start time interpreted in Tbilisi", async () => {
    const user = userEvent.setup();
    state.auth.isAdmin = true;
    const tournaments = [makeTournament()];
    state.actor.getTournaments.mockImplementation(async () => [...tournaments]);
    state.actor.createTournament.mockImplementation(
      async (input: TournamentInput) => {
        const tournament = makeTournament({ id: 2n, ...input });
        tournaments.push(tournament);
        return tournament;
      },
    );
    state.actor.updateTournament.mockImplementation(
      async (id: bigint, input: TournamentInput) => {
        const tournament = makeTournament({ id, ...input });
        tournaments.splice(
          tournaments.findIndex((entry) => entry.id === id),
          1,
          tournament,
        );
        return tournament;
      },
    );
    renderPage(<TournamentsPage />);
    await screen.findByRole("button", { name: "Warehouse Cup" });

    await user.click(screen.getByRole("button", { name: "New tournament" }));
    let editor = within(screen.getByRole("dialog"));
    await user.type(
      editor.getByLabelText("Tournament title"),
      "  Friday Rally  ",
    );
    await user.type(editor.getByLabelText("Venue"), "  Basement Bar  ");
    fireEvent.change(editor.getByLabelText(/Start time/), {
      target: { value: "2026-10-09T21:00" },
    });
    await user.clear(editor.getByLabelText("Player capacity"));
    await user.type(editor.getByLabelText("Player capacity"), "24");
    await user.selectOptions(editor.getByLabelText("Format"), "doubles");
    await user.type(
      editor.getByLabelText("The details / optional"),
      "  Arrive early  ",
    );
    await user.click(editor.getByRole("button", { name: "Create tournament" }));

    await screen.findByRole("button", { name: "Friday Rally" });
    const input = {
      title: "Friday Rally",
      description: "Arrive early",
      venue: "Basement Bar",
      startsAt,
      format: TournamentFormat.doubles,
      capacity: 24n,
      status: TournamentStatus.upcoming,
    };
    expect(state.actor.createTournament).toHaveBeenCalledWith(input);
    await user.click(screen.getByRole("button", { name: "Edit Friday Rally" }));
    editor = within(screen.getByRole("dialog"));
    expect(editor.getByLabelText(/Start time/)).toHaveValue("2026-10-09T21:00");
    await user.selectOptions(editor.getByLabelText("Status"), "live");
    await user.click(editor.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(state.actor.updateTournament).toHaveBeenCalledWith(2n, {
        ...input,
        status: TournamentStatus.live,
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
