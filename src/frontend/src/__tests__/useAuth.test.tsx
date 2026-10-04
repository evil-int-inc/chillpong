import { useAuth } from "@/hooks/useAuth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({
  principal: "owner-account",
  authenticated: true,
  admin: true,
}));

vi.mock("@caffeineai/core-infrastructure", () => ({
  useInternetIdentity: () => ({
    identity: { getPrincipal: () => ({ toString: () => session.principal }) },
    isAuthenticated: session.authenticated,
    isInitializing: false,
    isLoggingIn: false,
    login: vi.fn(),
    clear: vi.fn(),
  }),
  useActor: () => ({ actor, isFetching: false }),
}));

const actor = {
  getMyRole: async () => (session.admin ? "admin" : null),
  getCallerProfile: async () => null,
  bootstrapOwner: async () => {},
};

describe("authentication session changes", () => {
  it("clears admin UI on sign-out and isolates role caches between accounts", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, rerender } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isAdmin).toBe(true));

    session.authenticated = false;
    rerender();
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.role).toBeNull();

    session.principal = "member-account";
    session.authenticated = true;
    session.admin = false;
    rerender();
    expect(result.current.isAdmin).toBe(false);
    await waitFor(() => expect(result.current.roleLoading).toBe(false));
    expect(result.current.role).toBeNull();
    client.clear();
  });
});
