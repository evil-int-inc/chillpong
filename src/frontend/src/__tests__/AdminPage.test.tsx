import { Role, type UserRoleView } from "@/backend";
import { AdminPage } from "@/pages/AdminPage";
import { Principal } from "@icp-sdk/core/principal";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  auth: { isAdmin: true, principal: "" },
  actor: {
    listUsersWithRoles: vi.fn(),
    grantAdminRole: vi.fn(),
    revokeAdminRole: vi.fn(),
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
});
