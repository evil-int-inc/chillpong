import {
  DeleteTournamentError,
  type Tournament,
  TournamentFormat,
  TournamentStatus,
} from "@/backend";
import { TournamentsPage } from "@/pages/TournamentsPage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
  isAdmin: true,
  actor: { getTournaments: vi.fn(), deleteTournament: vi.fn() },
}));
vi.mock("@caffeineai/core-infrastructure", () => ({
  useActor: () => ({ actor: state.actor, isFetching: false }),
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ isAdmin: state.isAdmin }),
}));
let tournaments: Tournament[];
const firstTitle = "Warehouse Cup";
function tournament(id: bigint, title: string): Tournament {
  return {
    id,
    title,
    description: "Bring a paddle",
    venue: "ChillPong",
    startsAt: 1_800_000_000_000_000_000n,
    format: TournamentFormat.singles,
    capacity: 16n,
    status: TournamentStatus.upcoming,
    createdAt: 1n,
    updatedAt: 1n,
  };
}
function page() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false },
    },
  });
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <TournamentsPage />
      </QueryClientProvider>,
    ),
  };
}
async function openEditor(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole("button", { name: `Edit ${firstTitle}` }),
  );
  return screen.getByRole("dialog", { name: "Edit tournament." });
}
async function confirmDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Delete tournament" }));
  return screen.getByRole("dialog", { name: "Delete tournament?" });
}
beforeEach(() => {
  state.isAdmin = true;
  tournaments = [tournament(1n, firstTitle), tournament(2n, "Next Night")];
  state.actor.getTournaments
    .mockReset()
    .mockImplementation(async () => [...tournaments]);
  state.actor.deleteTournament
    .mockReset()
    .mockImplementation(async (id: bigint) => {
      tournaments = tournaments.filter((entry) => entry.id !== id);
      return { __kind__: "ok", ok: null };
    });
});

describe("tournament deletion", () => {
  it("does not expose deletion to visitors", async () => {
    state.isAdmin = false;
    page();
    await screen.findByRole("button", { name: firstTitle });
    expect(
      screen.queryByRole("button", { name: /Delete|Edit Warehouse Cup/ }),
    ).toBeNull();
    expect(state.actor.deleteTournament).not.toHaveBeenCalled();
  });

  it("does not offer deletion for an unsaved tournament", async () => {
    const user = userEvent.setup();
    page();
    await user.click(
      await screen.findByRole("button", { name: "New tournament" }),
    );
    expect(
      screen.getByRole("dialog", { name: "New tournament." }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Delete tournament" }),
    ).toBeNull();
  });

  it.each(["button", "Escape", "backdrop"])(
    "cancels confirmation with %s and preserves the tournament and editor draft",
    async (action) => {
      const user = userEvent.setup();
      page();
      const editor = await openEditor(user);
      const title = within(editor).getByLabelText("Tournament title");
      await user.clear(title);
      await user.type(title, "Unsaved title");
      const confirmation = await confirmDialog(user);
      expect(within(confirmation).getByText(firstTitle)).toBeVisible();
      expect(
        within(confirmation).getByRole("button", { name: "Cancel" }),
      ).toHaveFocus();
      expect(state.actor.deleteTournament).not.toHaveBeenCalled();
      if (action === "button")
        await user.click(
          within(confirmation).getByRole("button", { name: "Cancel" }),
        );
      else if (action === "Escape")
        fireEvent.keyDown(confirmation, { key: "Escape" });
      else fireEvent.click(confirmation);
      expect(
        screen.queryByRole("dialog", { name: "Delete tournament?" }),
      ).toBeNull();
      expect(editor).toBeVisible();
      expect(title).toHaveValue("Unsaved title");
      expect(state.actor.deleteTournament).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: firstTitle })).toBeVisible();
    },
  );

  it("deletes only after confirmation, blocks repeat requests, and clears list and room caches without refreshing", async () => {
    const user = userEvent.setup();
    let finish!: () => void;
    state.actor.deleteTournament.mockImplementationOnce(
      (id: bigint) =>
        new Promise((resolve) => {
          finish = () => {
            tournaments = tournaments.filter((entry) => entry.id !== id);
            resolve({ __kind__: "ok", ok: null });
          };
        }),
    );
    const { client } = page();
    client.setQueryData(["tournamentState", "1"], {
      retained: "until successful deletion",
    });
    client.setQueryData(["tournamentState", "2"], { retained: "other room" });
    await openEditor(user);
    const confirmation = await confirmDialog(user);
    const confirm = within(confirmation).getByRole("button", {
      name: "Delete permanently",
    });
    await user.dblClick(confirm);
    expect(state.actor.deleteTournament).toHaveBeenCalledExactlyOnceWith(1n);
    expect(confirm).toBeDisabled();
    expect(
      within(confirmation).getByRole("button", { name: "Cancel" }),
    ).toBeDisabled();
    fireEvent.keyDown(confirmation, { key: "Escape" });
    fireEvent.click(confirmation);
    expect(confirmation).toBeVisible();
    await act(async () => finish());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.queryByRole("button", { name: firstTitle })).toBeNull();
    expect(screen.getByRole("button", { name: "Next Night" })).toBeVisible();
    expect(screen.getByText(`${firstTitle} has been deleted.`)).toBeVisible();
    expect(client.getQueryData(["tournamentState", "1"])).toBeUndefined();
    expect(client.getQueryData(["tournamentState", "2"])).toEqual({
      retained: "other room",
    });
    expect(
      client
        .getQueryData<Tournament[]>(["tournaments"])
        ?.map((entry) => entry.id),
    ).toEqual([2n]);
  });

  it("keeps the tournament on a network error and lets the admin retry", async () => {
    const user = userEvent.setup();
    state.actor.deleteTournament.mockRejectedValueOnce(
      new Error("Couldn't delete this tournament. Try again."),
    );
    page();
    await openEditor(user);
    const confirmation = await confirmDialog(user);
    await user.click(
      within(confirmation).getByRole("button", { name: "Delete permanently" }),
    );
    expect(await within(confirmation).findByRole("alert")).toHaveTextContent(
      "Couldn't delete this tournament. Try again.",
    );
    expect(screen.getByRole("button", { name: firstTitle })).toBeVisible();
    await user.click(
      within(confirmation).getByRole("button", { name: "Delete permanently" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(state.actor.deleteTournament).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: firstTitle })).toBeNull();
  });

  it.each([
    [
      DeleteTournamentError.notAuthorized,
      "Unauthorized: Only admins can perform this action",
    ],
    [DeleteTournamentError.notFound, "Tournament not found"],
  ])(
    "handles the backend's %s rejection without removing the tournament",
    async (error, message) => {
      const user = userEvent.setup();
      state.actor.deleteTournament.mockResolvedValueOnce({
        __kind__: "err",
        err: error,
      });
      page();
      await openEditor(user);
      const confirmation = await confirmDialog(user);
      await user.click(
        within(confirmation).getByRole("button", {
          name: "Delete permanently",
        }),
      );
      expect(await within(confirmation).findByRole("alert")).toHaveTextContent(
        message,
      );
      expect(screen.getByRole("button", { name: firstTitle })).toBeVisible();
      expect(
        within(confirmation).getByRole("button", {
          name: "Delete permanently",
        }),
      ).toBeEnabled();
    },
  );
});
