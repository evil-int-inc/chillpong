import type { ProfileInput, User } from "@/backend";
import { ProfilePage } from "@/pages/ProfilePage";
import { Principal } from "@icp-sdk/core/principal";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  auth: { principal: "", isAuthenticated: true },
  actor: { getCallerProfile: vi.fn(), saveCallerProfile: vi.fn() },
}));
vi.mock("@caffeineai/core-infrastructure", () => ({
  useActor: () => ({ actor: state.actor, isFetching: false }),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => state.auth }));

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
