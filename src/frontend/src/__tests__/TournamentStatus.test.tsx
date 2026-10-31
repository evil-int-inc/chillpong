import { type Tournament, TournamentFormat, TournamentStatus } from "@/backend";
import { TournamentsPage } from "@/pages/TournamentsPage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  actor: { getTournaments: vi.fn(), updateTournament: vi.fn() },
}));
vi.mock("@caffeineai/core-infrastructure", () => ({
  useActor: () => ({ actor: state.actor, isFetching: false }),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ isAdmin: true }) }));
const original: Tournament = {
  id: 1n,
  title: "Warehouse Cup",
  description: "",
  venue: "ChillPong",
  startsAt: 1_800_000_000_000_000_000n,
  format: TournamentFormat.singles,
  capacity: 8n,
  status: TournamentStatus.live,
  createdAt: 1n,
  updatedAt: 1n,
};
function page() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false },
    },
  });
  render(
    <QueryClientProvider client={client}>
      <TournamentsPage />
    </QueryClientProvider>,
  );
  return client;
}
async function openEditor(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole("button", { name: "Edit Warehouse Cup" }),
  );
  return screen.getByRole("dialog", { name: "Edit tournament." });
}
beforeEach(() => vi.resetAllMocks());

describe("tournament status editor", () => {
  it.each([TournamentStatus.live, TournamentStatus.upcoming])(
    "immediately moves a %s tournament to Past games and refreshes its room cache",
    async (status) => {
      const user = userEvent.setup();
      let tournaments = [{ ...original, status }];
      let finishRefetch!: () => void;
      state.actor.getTournaments
        .mockResolvedValueOnce([...tournaments])
        .mockImplementation(
          () =>
            new Promise((resolve) => {
              finishRefetch = () => resolve([...tournaments]);
            }),
        );
      state.actor.updateTournament.mockImplementation(async (id, input) => {
        const updated = { ...original, ...input, id };
        tournaments = [updated];
        return updated;
      });
      const client = page();
      client.setQueryData(["tournamentState", "1"], {
        tournament: { ...original, status },
      });
      client.setQueryData(["tournamentState", "2"], { retained: "other room" });
      const editor = within(await openEditor(user));
      expect(editor.getByLabelText("Status")).toHaveValue(status);
      await user.selectOptions(
        editor.getByLabelText("Status"),
        TournamentStatus.completed,
      );
      await user.click(editor.getByRole("button", { name: "Save changes" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(state.actor.updateTournament).toHaveBeenCalledWith(
        1n,
        expect.objectContaining({ status: TournamentStatus.completed }),
      );
      expect(
        client.getQueryData<Tournament[]>(["tournaments"])?.[0].status,
      ).toBe(TournamentStatus.completed);
      expect(
        client.getQueryState(["tournamentState", "1"])?.isInvalidated,
      ).toBe(true);
      expect(
        client.getQueryState(["tournamentState", "2"])?.isInvalidated,
      ).toBe(false);
      await user.click(screen.getByRole("button", { name: "Past games" }));
      expect(
        screen.getByRole("button", { name: "Warehouse Cup" }),
      ).toBeVisible();
      // The saved status is visible before the background list refresh finishes.
      expect(
        within(await openEditor(user)).getByLabelText("Status"),
      ).toHaveValue(TournamentStatus.completed);
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      await act(async () => finishRefetch());
      await user.click(screen.getByRole("button", { name: "Live now" }));
      expect(
        screen.queryByRole("button", { name: "Warehouse Cup" }),
      ).toBeNull();
    },
  );

  it("keeps the saved status when the update fails and lets the admin retry", async () => {
    const user = userEvent.setup();
    let saved = original;
    state.actor.getTournaments.mockImplementation(async () => [saved]);
    state.actor.updateTournament
      .mockRejectedValueOnce(new Error("Couldn't save this change. Try again."))
      .mockImplementation(async (_id, input) => {
        saved = { ...original, ...input };
        return saved;
      });
    const client = page();
    const editor = within(await openEditor(user));
    await user.selectOptions(
      editor.getByLabelText("Status"),
      TournamentStatus.completed,
    );
    await user.click(editor.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(editor.getByRole("alert")).toHaveTextContent(
        "Couldn't save this change. Try again.",
      ),
    );
    expect(client.getQueryData<Tournament[]>(["tournaments"])?.[0].status).toBe(
      TournamentStatus.live,
    );
    await user.click(editor.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(client.getQueryData<Tournament[]>(["tournaments"])?.[0].status).toBe(
      TournamentStatus.completed,
    );
  });
});
