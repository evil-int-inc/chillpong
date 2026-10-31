import { DeletePlayerError, type GlobalPlayerView } from "@/backend";
import { SharedPlayersDirectory } from "@/components/players/SharedPlayersDirectory";
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
  actor: { listPlayers: vi.fn(), deletePlayer: vi.fn() },
}));
vi.mock("@caffeineai/core-infrastructure", () => ({
  useActor: () => ({ actor: state.actor, isFetching: false }),
}));
let players: GlobalPlayerView[];
function directory(isAdmin = true) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false },
    },
  });
  const result = render(
    <QueryClientProvider client={client}>
      <SharedPlayersDirectory isAdmin={isAdmin} />
    </QueryClientProvider>,
  );
  return { ...result, client };
}
async function openEditor(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole("button", { name: "Edit shared player Nino" }),
  );
  return screen.getByRole("dialog", { name: "Edit shared player" });
}
async function confirmDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Delete player" }));
  return screen.getByRole("dialog", { name: "Delete player?" });
}
beforeEach(() => {
  players = [1n, 2n].map((id) => ({
    id,
    name: id === 1n ? "Nino" : "Beka",
    skillLevel: 2n,
    createdAt: 1n,
    updatedAt: 1n,
  }));
  state.actor.listPlayers
    .mockReset()
    .mockImplementation(async () => [...players]);
  state.actor.deletePlayer
    .mockReset()
    .mockImplementation(async (id: bigint) => {
      players = players.filter((entry) => entry.id !== id);
      return { __kind__: "ok", ok: null };
    });
});

describe("player deletion", () => {
  it("hides editing and deletion from non-admins", async () => {
    directory(false);
    await screen.findByText("Nino");
    expect(
      screen.queryByRole("button", {
        name: /Edit shared player|Delete player/,
      }),
    ).toBeNull();
    expect(state.actor.deletePlayer).not.toHaveBeenCalled();
  });

  it("does not offer deletion for an unsaved player", async () => {
    const user = userEvent.setup();
    directory();
    await user.click(screen.getByRole("button", { name: "Create player" }));
    expect(screen.getByRole("dialog", { name: "Create player" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Delete player" })).toBeNull();
  });

  it.each(["button", "Escape", "backdrop"])(
    "cancels with %s without losing the editor draft",
    async (action) => {
      const user = userEvent.setup();
      directory();
      const editor = await openEditor(user);
      const name = within(editor).getByLabelText("Player name");
      await user.clear(name);
      await user.type(name, "Unsaved name");
      const confirmation = await confirmDialog(user);
      expect(within(confirmation).getByText("Nino")).toBeVisible();
      expect(
        within(confirmation).getByRole("button", { name: "Cancel" }),
      ).toHaveFocus();
      if (action === "button")
        await user.click(
          within(confirmation).getByRole("button", { name: "Cancel" }),
        );
      else if (action === "Escape")
        fireEvent.keyDown(confirmation, { key: "Escape" });
      else fireEvent.click(confirmation);
      expect(
        screen.queryByRole("dialog", { name: "Delete player?" }),
      ).toBeNull();
      expect(editor).toBeVisible();
      expect(name).toHaveValue("Unsaved name");
      expect(state.actor.deletePlayer).not.toHaveBeenCalled();
    },
  );

  it("deletes on confirmation once and updates the directory without a reload", async () => {
    const user = userEvent.setup();
    let finish!: () => void;
    state.actor.deletePlayer.mockImplementationOnce(
      (id: bigint) =>
        new Promise((resolve) => {
          finish = () => {
            players = players.filter((entry) => entry.id !== id);
            resolve({ __kind__: "ok", ok: null });
          };
        }),
    );
    const { client } = directory();
    client.setQueryData(["tournamentState", "3"], { retained: "results" });
    await openEditor(user);
    const confirmation = await confirmDialog(user);
    const confirm = within(confirmation).getByRole("button", {
      name: "Delete permanently",
    });
    expect(state.actor.deletePlayer).not.toHaveBeenCalled();
    await user.dblClick(confirm);
    expect(state.actor.deletePlayer).toHaveBeenCalledExactlyOnceWith(1n);
    expect(confirm).toBeDisabled();
    expect(
      within(confirmation).getByRole("button", { name: "Cancel" }),
    ).toBeDisabled();
    fireEvent.keyDown(confirmation, { key: "Escape" });
    fireEvent.click(confirmation);
    expect(confirmation).toBeVisible();
    await act(async () => finish());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.queryByText("Nino")).toBeNull();
    expect(screen.getByText("Beka")).toBeVisible();
    expect(
      screen.getByText("Player deleted from the shared directory."),
    ).toBeVisible();
    expect(
      client
        .getQueryData<GlobalPlayerView[]>(["players"])
        ?.map((entry) => entry.id),
    ).toEqual([2n]);
    expect(client.getQueryState(["tournamentState", "3"])?.isInvalidated).toBe(
      true,
    );
    expect(client.getQueryData(["tournamentState", "3"])).toEqual({
      retained: "results",
    });
  });

  it("preserves the player on failure and allows retry", async () => {
    const user = userEvent.setup();
    state.actor.deletePlayer.mockRejectedValueOnce(
      new Error("Couldn't delete this player. Try again."),
    );
    directory();
    await openEditor(user);
    const confirmation = await confirmDialog(user);
    await user.click(
      within(confirmation).getByRole("button", { name: "Delete permanently" }),
    );
    expect(await within(confirmation).findByRole("alert")).toHaveTextContent(
      "Couldn't delete this player. Try again.",
    );
    expect(
      screen.getByRole("button", { name: "Edit shared player Nino" }),
    ).toBeVisible();
    await user.click(
      within(confirmation).getByRole("button", { name: "Delete permanently" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(state.actor.deletePlayer).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Nino")).toBeNull();
  });

  it.each([
    [
      DeletePlayerError.notAuthorized,
      "Unauthorized: Only admins can perform this action",
    ],
    [DeletePlayerError.notFound, "Player not found"],
  ])(
    "shows the backend's %s error without removing the player",
    async (error, message) => {
      const user = userEvent.setup();
      state.actor.deletePlayer.mockResolvedValueOnce({
        __kind__: "err",
        err: error,
      });
      directory();
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
      expect(
        screen.getByRole("button", { name: "Edit shared player Nino" }),
      ).toBeVisible();
    },
  );
});
