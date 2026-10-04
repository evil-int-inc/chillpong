import { ExternalBlob } from "@/backend";
import { ProfilePage } from "@/pages/ProfilePage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actorMocks = vi.hoisted(() => ({
  getChannelByUsername: vi.fn(async () => null),
  saveProfile: vi.fn(),
}));

vi.mock("@caffeineai/core-infrastructure", () => ({
  useActor: () => ({ actor: actorMocks, isFetching: false }),
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({
    data: null,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

beforeEach(() => {
  actorMocks.getChannelByUsername.mockClear();
  actorMocks.saveProfile.mockReset();
  actorMocks.saveProfile.mockResolvedValue({
    id: "aaaaa-aa",
    displayName: "Ada",
    username: "ada",
    avatar: ExternalBlob.fromURL("https://example.com/avatar"),
    createdAt: 0n,
  });
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:avatar-preview"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
});

describe("ProfilePage", () => {
  it("uploads the selected avatar instead of accepting an image URL", async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <ProfilePage />
      </QueryClientProvider>,
    );

    expect(screen.queryByLabelText("Avatar URL")).not.toBeInTheDocument();
    await user.type(screen.getByTestId("display_name_input"), "Ada");
    await user.type(screen.getByTestId("username_input"), "ada");
    const avatar = new File([new Uint8Array([1, 2, 3])], "avatar.png", {
      type: "image/png",
    });
    Object.defineProperty(avatar, "arrayBuffer", {
      value: async () => new Uint8Array([1, 2, 3]).buffer,
    });
    await user.upload(screen.getByTestId("avatar_input"), avatar);
    await user.click(screen.getByTestId("save_button"));

    await waitFor(() => expect(actorMocks.saveProfile).toHaveBeenCalled());
    const args = actorMocks.saveProfile.mock.calls[0];
    expect(args[0]).toBe("Ada");
    expect(args[1]).toBe("ada");
    expect(args[2]).toBeInstanceOf(ExternalBlob);
    expect(args[3]).toBe(false);
  });
});
