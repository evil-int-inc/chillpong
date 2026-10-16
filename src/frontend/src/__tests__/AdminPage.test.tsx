import {
  type GlobalPlayerView as GlobalPlayer,
  Role,
  type UserRoleView,
} from "@/backend";
import { AdminPage } from "@/pages/AdminPage";
import { Principal } from "@icp-sdk/core/principal";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  auth: { isAdmin: true, principal: "" },
  actor: {
    listUsersWithRoles: vi.fn(),
    grantAdminRole: vi.fn(),
    revokeAdminRole: vi.fn(),
    listPlayers: vi.fn(),
    linkPlayerToUser: vi.fn(),
    unlinkPlayerFromUser: vi.fn(),
    getTelegramLinkConfig: vi.fn(),
    setTelegramLinkConfig: vi.fn(),
  },
}));

vi.mock("@caffeineai/core-infrastructure", () => ({
  useActor: () => ({ actor: state.actor, isFetching: false }),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => state.auth }));

const owner = Principal.fromUint8Array(new Uint8Array([1, 2, 3]));
const member = Principal.fromUint8Array(new Uint8Array(29).fill(4));
const other = Principal.fromUint8Array(new Uint8Array([5, 6, 7]));
let accounts: UserRoleView[];
let players: GlobalPlayer[];

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  const page = render(
    <QueryClientProvider client={client}>
      <AdminPage />
    </QueryClientProvider>,
  );
  return { ...page, client };
}

beforeEach(() => {
  state.auth.isAdmin = true;
  state.auth.principal = owner.toString();
  accounts = [
    { id: owner, displayName: "Owner", username: "owner", role: Role.admin },
    { id: member, displayName: "Signed-in member", username: "" },
    { id: other, displayName: "Nino", username: "nino" },
  ];
  for (const method of Object.values(state.actor)) method.mockReset();
  state.actor.listUsersWithRoles.mockImplementation(async () => [...accounts]);
  state.actor.getTelegramLinkConfig.mockResolvedValue({});
  state.actor.setTelegramLinkConfig.mockResolvedValue(undefined);
  players = [
    {
      id: 10n,
      name: "Player Nino",
      skillLevel: 4n,
      createdAt: 0n,
      updatedAt: 0n,
    },
    {
      id: 11n,
      name: "Player Giorgi",
      skillLevel: 2n,
      userId: owner,
      createdAt: 0n,
      updatedAt: 0n,
    },
  ];
  state.actor.listPlayers.mockImplementation(async () => [...players]);
  state.actor.linkPlayerToUser.mockImplementation(
    async (playerId: bigint, userId: Principal) => {
      const player = players.find((item) => item.id === playerId)!;
      player.userId = userId;
      accounts.find(
        (account) => account.id.toString() === userId.toString(),
      )!.displayName = player.name;
      return { ...player };
    },
  );
  state.actor.unlinkPlayerFromUser.mockImplementation(
    async (playerId: bigint) => {
      const player = players.find((item) => item.id === playerId)!;
      player.userId = undefined;
      return { ...player };
    },
  );
  state.actor.grantAdminRole.mockImplementation(async (id: Principal) => {
    const account = accounts.find(
      (entry) => entry.id.toString() === id.toString(),
    );
    if (!account) throw new Error("Account not found");
    account.role = Role.admin;
    return { ...account };
  });
  state.actor.revokeAdminRole.mockImplementation(async (id: Principal) => {
    const account = accounts.find(
      (entry) => entry.id.toString() === id.toString(),
    );
    if (!account) throw new Error("Account not found");
    account.role = undefined;
    return { ...account };
  });
});

describe("authenticated account administration", () => {
  it("shows the saved Telegram avatar alongside the authenticated account", async () => {
    accounts[2].avatarUrl = "https://t.me/i/userpic/320/nino.jpg";
    renderPage();
    const avatar = await screen.findByRole("img", { name: "Nino avatar" });
    expect(avatar).toHaveAttribute(
      "src",
      "https://t.me/i/userpic/320/nino.jpg",
    );
    expect(avatar.closest("li")).toHaveTextContent(other.toString());
  });

  it("filters by full and partial member IDs and clears missed searches", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(member.toString());
    const search = screen.getByRole("searchbox", {
      name: "Search by member ID",
    });
    await user.type(search, `  ${member.toString().toUpperCase()}  `);
    expect(screen.getByText(member.toString())).toBeVisible();
    expect(screen.queryByText(owner.toString())).toBeNull();
    expect(screen.getByText("1 of 3 accounts match")).toBeVisible();
    await user.clear(search);
    await user.type(search, member.toString().slice(0, 12));
    expect(screen.getByText(member.toString())).toBeVisible();
    await user.clear(search);
    await user.type(search, "missing-principal");
    expect(screen.getByText("No matching member ID")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByText(owner.toString())).toBeVisible();
    expect(screen.getByText(member.toString())).toBeVisible();
  });
  it("shows full member principals for accounts with and without profiles", async () => {
    renderPage();
    expect(await screen.findByText(member.toString())).toBeVisible();
    expect(screen.getByText(owner.toString())).toBeVisible();
    expect(screen.getByText(other.toString())).toBeVisible();
    expect(screen.getByText("Username not set")).toBeVisible();
    expect(screen.getByText("3 accounts / 1 admin")).toBeVisible();
    expect(
      screen.getByRole("button", { name: `Revoke admin from ${owner}` }),
    ).toBeDisabled();
  });

  it("assigns and revokes admin by principal for an account without a profile", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(
      await screen.findByRole("button", { name: `Assign admin to ${member}` }),
    );
    expect(state.actor.grantAdminRole).toHaveBeenCalledWith(member);
    expect(
      await screen.findByText("Signed-in member is now an admin."),
    ).toBeVisible();
    await user.click(
      await screen.findByRole("button", {
        name: `Revoke admin from ${member}`,
      }),
    );
    expect(state.actor.revokeAdminRole).toHaveBeenCalledWith(member);
    expect(
      await screen.findByText("Signed-in member is no longer an admin."),
    ).toBeVisible();
    expect(
      await screen.findByRole("button", { name: `Assign admin to ${member}` }),
    ).toBeEnabled();
  });

  it("copies the full principal and refreshes newly signed-in accounts", async () => {
    const user = userEvent.setup();
    const copy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    renderPage();
    await user.click(
      await screen.findByRole("button", { name: `Copy member ID ${member}` }),
    );
    expect(copy).toHaveBeenCalledWith(member.toString());
    const newcomer = Principal.fromUint8Array(new Uint8Array([8, 9, 10]));
    accounts.push({
      id: newcomer,
      displayName: "Signed-in member",
      username: "",
    });
    await user.click(screen.getByRole("button", { name: "Refresh accounts" }));
    expect(await screen.findByText(newcomer.toString())).toBeVisible();
    copy.mockRestore();
  });

  it("keeps role errors visible and blocks concurrent role changes", async () => {
    const user = userEvent.setup();
    let rejectGrant: (error: Error) => void = () => {};
    state.actor.grantAdminRole.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectGrant = reject;
        }),
    );
    renderPage();
    await user.click(
      await screen.findByRole("button", { name: `Assign admin to ${member}` }),
    );
    expect(
      screen.getByRole("button", { name: `Assign admin to ${other}` }),
    ).toBeDisabled();
    rejectGrant(new Error("Permission denied"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Permission denied",
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: `Assign admin to ${member}` }),
      ).toBeEnabled(),
    );
  });

  it("does not fetch or reveal accounts after admin access is lost", async () => {
    const page = renderPage();
    await screen.findByText(member.toString());
    state.auth.isAdmin = false;
    page.rerender(
      <QueryClientProvider client={page.client}>
        <AdminPage />
      </QueryClientProvider>,
    );
    expect(screen.queryByText(member.toString())).toBeNull();
    expect(state.actor.listUsersWithRoles).toHaveBeenCalledTimes(1);
  });
  it("links a shared player by principal, replacing a member's existing name and preventing occupied links", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(
      await screen.findByRole("button", {
        name: `Link player for member ${other}`,
      }),
    );
    const dialog = within(screen.getByRole("dialog"));
    expect(
      await dialog.findByRole("option", {
        name: "Player Giorgi / L2 / Already linked",
      }),
    ).toBeDisabled();
    await user.type(
      dialog.getByRole("searchbox", { name: "Search shared players" }),
      "nino",
    );
    expect(
      dialog.queryByRole("option", {
        name: "Player Giorgi / L2 / Already linked",
      }),
    ).toBeNull();
    await user.selectOptions(dialog.getByLabelText("Player to link"), "10");
    expect(
      dialog.getByText(/Linking replaces this member's name/),
    ).toBeVisible();
    await user.click(dialog.getByRole("button", { name: "Link player" }));
    expect(state.actor.linkPlayerToUser).toHaveBeenCalledWith(10n, other);
    expect(
      await screen.findByText(
        "Player linked. The member's name is now Player Nino.",
      ),
    ).toBeVisible();
    expect(await screen.findByText("Player Nino")).toBeVisible();
    expect(screen.queryByText("Nino")).toBeNull();
    expect(await screen.findByText("Linked player: Player Nino")).toBeVisible();
  });

  it("unlinks an existing player without undoing the member's name", async () => {
    const user = userEvent.setup();
    accounts[2].displayName = "Player Nino";
    players[0].userId = other;
    renderPage();
    await user.click(
      await screen.findByRole("button", {
        name: `Link player for member ${other}`,
      }),
    );
    const dialog = within(screen.getByRole("dialog"));
    await user.click(
      await dialog.findByRole("button", { name: "Unlink player" }),
    );
    expect(state.actor.unlinkPlayerFromUser).toHaveBeenCalledWith(10n);
    expect(
      await screen.findByText(
        "Player unlinked. The member's name is unchanged.",
      ),
    ).toBeVisible();
    expect(screen.getByText("Player Nino")).toBeVisible();
    expect(screen.queryByText("Linked player: Player Nino")).toBeNull();
  });

  it("leaves a failed player link open and blocks duplicate submissions", async () => {
    const user = userEvent.setup();
    let rejectLink: (error: Error) => void = () => {};
    state.actor.linkPlayerToUser.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectLink = reject;
        }),
    );
    renderPage();
    await user.click(
      await screen.findByRole("button", {
        name: `Link player for member ${member}`,
      }),
    );
    const dialog = within(screen.getByRole("dialog"));
    await dialog.findByRole("option", { name: "Player Nino / L4" });
    await user.selectOptions(dialog.getByLabelText("Player to link"), "10");
    await user.click(dialog.getByRole("button", { name: "Link player" }));
    expect(dialog.getByRole("button", { name: /Link player$/ })).toBeDisabled();
    expect(dialog.getByRole("button", { name: "Cancel" })).toBeDisabled();
    rejectLink(new Error("Player already linked"));
    expect(await dialog.findByRole("alert")).toHaveTextContent(
      "Player already linked",
    );
    expect(dialog.getByRole("button", { name: "Link player" })).toBeEnabled();
    expect(state.actor.linkPlayerToUser).toHaveBeenCalledTimes(1);
  });
});

describe("admin Telegram linking configuration", () => {
  it("saves only the public numeric client ID and clears it to disable linking", async () => {
    const user = userEvent.setup();
    const page = renderPage();
    const input = await screen.findByRole("textbox", {
      name: "Telegram Login Client ID",
    });
    await waitFor(() => expect(input).toBeEnabled());
    expect(
      screen.getByRole("button", { name: "Save Telegram settings" }),
    ).toBeDisabled();
    expect(
      screen.getByText(
        "Use the public Login Client ID from BotFather. Leave blank to disable linking. Bot tokens and client secrets are not needed here.",
      ),
    ).toBeVisible();
    await user.type(input, "8851986381");
    await user.click(
      screen.getByRole("button", { name: "Save Telegram settings" }),
    );
    expect(state.actor.setTelegramLinkConfig).toHaveBeenCalledExactlyOnceWith(
      "8851986381",
    );
    expect(await screen.findByText("Telegram settings saved.")).toBeVisible();
    expect(page.client.getQueryData(["telegramConfig"])).toEqual({
      clientId: "8851986381",
    });
    await user.clear(input);
    await user.click(
      screen.getByRole("button", { name: "Save Telegram settings" }),
    );
    await waitFor(() =>
      expect(state.actor.setTelegramLinkConfig).toHaveBeenLastCalledWith(null),
    );
    expect(page.client.getQueryData(["telegramConfig"])).toEqual({
      clientId: undefined,
    });
    expect(screen.queryByRole("textbox", { name: /token|secret/i })).toBeNull();
  });

  it("rejects nonnumeric, zero and unsafe client IDs without contacting the backend", async () => {
    const user = userEvent.setup();
    renderPage();
    const input = await screen.findByRole("textbox", {
      name: "Telegram Login Client ID",
    });
    await waitFor(() => expect(input).toBeEnabled());
    for (const value of ["not-a-client-id", "0", "9007199254740992"]) {
      await user.clear(input);
      await user.type(input, value);
      await user.click(
        screen.getByRole("button", { name: "Save Telegram settings" }),
      );
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Enter a valid numeric Telegram Login Client ID.",
      );
      expect(state.actor.setTelegramLinkConfig).not.toHaveBeenCalled();
    }
  });

  it("keeps an unsuccessful settings draft and supports retrying a failed load", async () => {
    const user = userEvent.setup();
    state.actor.getTelegramLinkConfig
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValue({ clientId: "8851986381" });
    state.actor.setTelegramLinkConfig.mockRejectedValue(
      new Error("Permission denied"),
    );
    const page = renderPage();
    expect(
      await screen.findByText("Couldn't load Telegram settings."),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    const input = await screen.findByRole("textbox", {
      name: "Telegram Login Client ID",
    });
    await waitFor(() => expect(input).toHaveValue("8851986381"));
    await user.clear(input);
    await user.type(input, "123456789");
    await user.click(
      screen.getByRole("button", { name: "Save Telegram settings" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Permission denied",
    );
    expect(input).toHaveValue("123456789");
    expect(page.client.getQueryData(["telegramConfig"])).toEqual({
      clientId: "8851986381",
    });
  });

  it("does not reveal or load Telegram settings without admin access", async () => {
    state.auth.isAdmin = false;
    renderPage();
    expect(
      screen.queryByRole("textbox", { name: "Telegram Login Client ID" }),
    ).toBeNull();
    expect(state.actor.getTelegramLinkConfig).not.toHaveBeenCalled();
    expect(state.actor.setTelegramLinkConfig).not.toHaveBeenCalled();
  });
});
