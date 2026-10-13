import type { ProfileInput, User } from "@/backend";
import { ProfilePage } from "@/pages/ProfilePage";
import type { TelegramLoginResult } from "@/services/telegram-login";
import { Principal } from "@icp-sdk/core/principal";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  auth: { principal: "", isAuthenticated: true },
  actor: {
    getCallerProfile: vi.fn(),
    saveCallerProfile: vi.fn(),
    getTelegramLinkConfig: vi.fn(),
    getCallerTelegramLink: vi.fn(),
    startTelegramLink: vi.fn(),
    completeTelegramLink: vi.fn(),
    unlinkTelegram: vi.fn(),
  },
  sdk: { auth: vi.fn(), close: vi.fn(), load: vi.fn() },
}));
vi.mock("@caffeineai/core-infrastructure", () => ({
  useActor: () => ({ actor: state.actor, isFetching: false }),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => state.auth }));
vi.mock("@/services/telegram-login", () => ({
  loadTelegramLogin: () => state.sdk.load(),
}));

const member = Principal.fromUint8Array(new Uint8Array([4, 5, 6]));
const other = Principal.fromUint8Array(new Uint8Array([7, 8, 9]));
let profile: User | null;

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  const page = render(
    <QueryClientProvider client={client}>
      <ProfilePage />
    </QueryClientProvider>,
  );
  return { ...page, client };
}

beforeEach(() => {
  state.auth.principal = member.toString();
  state.auth.isAuthenticated = true;
  profile = null;
  state.actor.getTelegramLinkConfig.mockReset().mockResolvedValue({});
  state.actor.getCallerTelegramLink.mockReset().mockResolvedValue(null);
  state.actor.startTelegramLink.mockReset().mockResolvedValue({
    clientId: "8851986381",
    nonce: "server-nonce",
    expiresAt: BigInt(Date.now() + 600_000) * 1_000_000n,
  });
  state.actor.completeTelegramLink.mockReset();
  state.actor.unlinkTelegram.mockReset();
  state.sdk.auth.mockReset();
  state.sdk.close.mockReset();
  state.sdk.load.mockReset().mockResolvedValue(state.sdk);
  state.actor.getCallerProfile
    .mockReset()
    .mockImplementation(async () => profile);
  state.actor.saveCallerProfile
    .mockReset()
    .mockImplementation(async (input: ProfileInput) => {
      profile = { id: member, createdAt: 1n, ...profile, ...input };
      return { ...profile };
    });
});

describe("self-service member profiles", () => {
  it("allows an ordinary signed-in member to save both fields empty", async () => {
    const user = userEvent.setup();
    const page = renderPage();
    const name = await screen.findByRole("textbox", {
      name: "Name / optional",
    });
    const username = screen.getByRole("textbox", {
      name: "Username / optional",
    });
    expect(name).not.toBeRequired();
    expect(username).not.toBeRequired();
    expect(name).toHaveValue("");
    expect(username).toHaveValue("");
    expect(screen.getByText(member.toString())).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(state.actor.saveCallerProfile).toHaveBeenCalledWith({
      displayName: "",
      username: "",
    });
    expect(await screen.findByText("Profile saved.")).toBeVisible();
    expect(page.client.getQueryData(["profile", member.toString()])).toEqual(
      profile,
    );
  });

  it("loads existing values, normalizes changes, and allows clearing them", async () => {
    const user = userEvent.setup();
    profile = {
      id: member,
      displayName: "Luka",
      username: "luka",
      bio: "Keep this bio",
      createdAt: 1n,
    };
    renderPage();
    const name = await screen.findByRole("textbox", {
      name: "Name / optional",
    });
    const username = screen.getByRole("textbox", {
      name: "Username / optional",
    });
    expect(name).toHaveValue("Luka");
    expect(username).toHaveValue("luka");
    await user.clear(name);
    await user.type(name, "  Nino  ");
    await user.clear(username);
    await user.type(username, "  NINO  ");
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(await screen.findByText("Profile saved.")).toBeVisible();
    expect(state.actor.saveCallerProfile).toHaveBeenLastCalledWith({
      displayName: "Nino",
      username: "nino",
    });
    expect(name).toHaveValue("Nino");
    expect(username).toHaveValue("nino");
    await user.clear(name);
    await user.clear(username);
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(await screen.findByText("Profile saved.")).toBeVisible();
    expect(state.actor.saveCallerProfile).toHaveBeenLastCalledWith({
      displayName: "",
      username: "",
    });
  });

  it("preserves an unchanged legacy username when saving another field", async () => {
    const user = userEvent.setup();
    profile = { id: member, displayName: "Luka", username: "Ä", createdAt: 1n };
    renderPage();
    const name = await screen.findByRole("textbox", {
      name: "Name / optional",
    });
    await user.clear(name);
    await user.type(name, "Luka B");
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(await screen.findByText("Profile saved.")).toBeVisible();
    expect(state.actor.saveCallerProfile).toHaveBeenCalledWith({
      displayName: "Luka B",
      username: "Ä",
    });
  });

  it("validates provided usernames and keeps server errors and unsaved values visible", async () => {
    const user = userEvent.setup();
    renderPage();
    const username = await screen.findByRole("textbox", {
      name: "Username / optional",
    });
    await user.type(username, "a");
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Username needs 3–30");
    expect(state.actor.saveCallerProfile).not.toHaveBeenCalled();
    await user.clear(username);
    await user.type(username, "taken");
    state.actor.saveCallerProfile.mockRejectedValueOnce(
      new Error("Username already taken"),
    );
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Username already taken",
    );
    expect(username).toHaveValue("taken");
    expect(profile).toBeNull();
  });

  it("requires successful profile loading before editing and supports retry", async () => {
    const user = userEvent.setup();
    state.actor.getCallerProfile.mockRejectedValueOnce(new Error("Offline"));
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't load your profile",
    );
    expect(screen.queryByRole("textbox")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("textbox", { name: "Name / optional" }),
    ).toBeVisible();
  });

  it("isolates profile drafts between accounts and hides the form on sign-out", async () => {
    const user = userEvent.setup();
    const page = renderPage();
    await user.type(
      await screen.findByRole("textbox", { name: "Name / optional" }),
      "Unsaved first account",
    );
    state.auth.principal = other.toString();
    page.rerender(
      <QueryClientProvider client={page.client}>
        <ProfilePage />
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: "Name / optional" }),
      ).toHaveValue(""),
    );
    expect(screen.getByText(other.toString())).toBeVisible();
    state.auth.isAuthenticated = false;
    page.rerender(
      <QueryClientProvider client={page.client}>
        <ProfilePage />
      </QueryClientProvider>,
    );
    expect(screen.queryByRole("button", { name: "Save profile" })).toBeNull();
    expect(state.actor.saveCallerProfile).not.toHaveBeenCalled();
  });
});

function enableTelegram() {
  state.actor.getTelegramLinkConfig.mockResolvedValue({
    clientId: "8851986381",
  });
  profile = {
    id: member,
    displayName: "Saved Name",
    username: "previous-handle",
    createdAt: 1n,
  };
}
async function readyTelegramButton() {
  const button = await screen.findByRole("button", { name: "Link Telegram" });
  await waitFor(() => expect(button).toBeEnabled());
  return button;
}
function telegramCallback() {
  return state.sdk.auth.mock.calls.at(-1)?.[1] as (
    result: TelegramLoginResult & { user?: Record<string, unknown> },
  ) => void;
}

describe("verified Telegram profile linking", () => {
  it("opens the SDK synchronously using the already-prefetched server nonce and public client ID", async () => {
    enableTelegram();
    renderPage();
    const button = await readyTelegramButton();
    expect(state.actor.startTelegramLink).toHaveBeenCalledTimes(1);
    const challengeCalls = state.actor.startTelegramLink.mock.calls.length;
    fireEvent.click(button);
    // A popup opened after an awaited canister request loses user activation on
    // mobile browsers; the SDK call must finish before this click returns.
    expect(state.sdk.auth).toHaveBeenCalledTimes(1);
    expect(state.actor.startTelegramLink).toHaveBeenCalledTimes(challengeCalls);
    expect(state.sdk.auth).toHaveBeenCalledWith(
      {
        client_id: 8851986381,
        nonce: "server-nonce",
        scope: ["profile"],
        lang: "en",
      },
      expect.any(Function),
    );
    expect(state.actor.completeTelegramLink).not.toHaveBeenCalled();
  });

  it("sends only the signed token, replaces an unsaved username, and preserves an unchanged name draft", async () => {
    const user = userEvent.setup();
    enableTelegram();
    state.actor.completeTelegramLink.mockImplementation(async () => {
      profile = { ...profile!, username: "verified_telegram" };
      return { ...profile };
    });
    const page = renderPage();
    const button = await readyTelegramButton();
    const name = screen.getByRole("textbox", { name: "Name / optional" });
    const username = screen.getByRole("textbox", {
      name: "Username / optional",
    });
    await user.clear(name);
    await user.type(name, "Unsaved club name");
    await user.clear(username);
    await user.type(username, "a");
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Username needs 3–30");
    await user.click(button);
    await act(async () =>
      telegramCallback()({
        id_token: "opaque-signed-token-placeholder",
        user: {
          preferred_username: "spoofed_username",
          username: "spoofed_username",
          id: 999,
          name: "Spoofed name",
        },
      }),
    );
    expect(state.actor.completeTelegramLink).toHaveBeenCalledExactlyOnceWith(
      "opaque-signed-token-placeholder",
    );
    expect(state.actor.saveCallerProfile).not.toHaveBeenCalled();
    expect(
      await screen.findByText(
        "Telegram linked. Your username now matches Telegram.",
      ),
    ).toBeVisible();
    expect(username).toHaveValue("verified_telegram");
    expect(name).toHaveValue("Unsaved club name");
    expect(screen.queryByRole("alert")).toBeNull();
    const saved = page.client.getQueryData<User>([
      "profile",
      member.toString(),
    ]);
    expect(saved?.displayName).toBe("Saved Name");
    expect(saved?.username).toBe("verified_telegram");
    expect(saved?.id.toString()).toBe(member.toString());
    expect(screen.getByText(member.toString())).toBeVisible();
  });

  it("keeps the saved account and draft unchanged when token verification fails", async () => {
    const user = userEvent.setup();
    enableTelegram();
    state.actor.completeTelegramLink.mockRejectedValue(
      new Error("Invalid Telegram proof"),
    );
    const page = renderPage();
    const button = await readyTelegramButton();
    const username = screen.getByRole("textbox", {
      name: "Username / optional",
    });
    await user.clear(username);
    await user.type(username, "unsaved-handle");
    await user.click(button);
    await act(async () =>
      telegramCallback()({
        id_token: "rejected-proof",
        user: { username: "untrusted" },
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid Telegram proof",
    );
    expect(username).toHaveValue("unsaved-handle");
    expect(
      page.client.getQueryData<User>(["profile", member.toString()])?.username,
    ).toBe("previous-handle");
    expect(profile?.username).toBe("previous-handle");
    expect(
      screen.queryByText(
        "Telegram linked. Your username now matches Telegram.",
      ),
    ).toBeNull();
  });

  it("cancels a popup and ignores its late callback even after a new attempt starts", async () => {
    const user = userEvent.setup();
    enableTelegram();
    renderPage();
    await user.click(await readyTelegramButton());
    const abandoned = telegramCallback();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(state.sdk.close).toHaveBeenCalled();
    await user.click(await readyTelegramButton());
    expect(state.sdk.auth).toHaveBeenCalledTimes(2);
    await act(async () => abandoned({ id_token: "late-abandoned-proof" }));
    expect(state.actor.completeTelegramLink).not.toHaveBeenCalled();
    expect(profile?.username).toBe("previous-handle");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
  });

  it("unlinks Telegram while keeping the username and principal", async () => {
    const user = userEvent.setup();
    enableTelegram();
    profile!.username = "existing_telegram";
    let linked = true;
    state.actor.getCallerTelegramLink.mockImplementation(async () =>
      linked
        ? {
            username: "existing_telegram",
            subject: "telegram-account",
            linkedAt: 1n,
          }
        : null,
    );
    state.actor.unlinkTelegram.mockImplementation(async () => {
      linked = false;
      return { ...profile! };
    });
    const page = renderPage();
    await user.click(
      await screen.findByRole("button", { name: "Unlink Telegram" }),
    );
    expect(state.actor.unlinkTelegram).toHaveBeenCalledExactlyOnceWith();
    expect(
      await screen.findByText("Telegram unlinked. Your username is unchanged."),
    ).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: "Username / optional" }),
    ).toHaveValue("existing_telegram");
    expect(
      page.client.getQueryData<User>(["profile", member.toString()])?.username,
    ).toBe("existing_telegram");
    expect(
      page.client
        .getQueryData<User>(["profile", member.toString()])
        ?.id.toString(),
    ).toBe(member.toString());
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Unlink Telegram" }),
      ).toBeNull(),
    );
    expect(state.actor.completeTelegramLink).not.toHaveBeenCalled();
  });

  it("preserves a verified 32-character Telegram username when editing the optional name", async () => {
    const user = userEvent.setup();
    const handle = "t".repeat(32);
    profile = {
      id: member,
      displayName: "Nino",
      username: handle,
      createdAt: 1n,
    };
    renderPage();
    const name = await screen.findByRole("textbox", {
      name: "Name / optional",
    });
    const username = screen.getByRole("textbox", {
      name: "Username / optional",
    });
    expect(username).toHaveValue(handle);
    expect(username).not.toHaveAttribute("maxlength");
    await user.clear(name);
    await user.type(name, "Nino B");
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(await screen.findByText("Profile saved.")).toBeVisible();
    expect(state.actor.saveCallerProfile).toHaveBeenCalledWith({
      displayName: "Nino B",
      username: handle,
    });
    expect(username).toHaveValue(handle);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps linking disabled without loading the SDK when the backend has no public client ID", async () => {
    renderPage();
    expect(
      await screen.findByText(
        "Telegram linking is not configured yet. Ask an admin to set the public Login Client ID.",
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Link Telegram" }),
    ).toBeDisabled();
    expect(state.sdk.load).not.toHaveBeenCalled();
    expect(state.actor.startTelegramLink).not.toHaveBeenCalled();
    expect(state.sdk.auth).not.toHaveBeenCalled();
  });

  it("retries a failed server challenge before enabling the popup", async () => {
    const user = userEvent.setup();
    enableTelegram();
    state.actor.startTelegramLink.mockRejectedValueOnce(
      new Error("Challenge unavailable"),
    );
    renderPage();
    expect(
      await screen.findByText("Couldn't prepare Telegram linking. Try again."),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Link Telegram" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await readyTelegramButton()).toBeEnabled();
    expect(state.actor.startTelegramLink).toHaveBeenCalledTimes(2);
    expect(state.sdk.auth).not.toHaveBeenCalled();
  });

  it("ignores a popup response after the authenticated profile is unmounted", async () => {
    const user = userEvent.setup();
    enableTelegram();
    const page = renderPage();
    await user.click(await readyTelegramButton());
    const callback = telegramCallback();
    state.auth.isAuthenticated = false;
    page.rerender(
      <QueryClientProvider client={page.client}>
        <ProfilePage />
      </QueryClientProvider>,
    );
    expect(screen.queryByRole("button", { name: /Telegram/ })).toBeNull();
    expect(state.sdk.close).toHaveBeenCalled();
    await act(async () => callback({ id_token: "late-signout-proof" }));
    expect(state.actor.completeTelegramLink).not.toHaveBeenCalled();
    expect(profile?.username).toBe("previous-handle");
  });
});
