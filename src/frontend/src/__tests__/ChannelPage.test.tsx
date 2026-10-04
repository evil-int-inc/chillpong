import { ExternalBlob } from "@/backend";
import { ChannelPage } from "@/pages/ChannelPage";
import { VideoStatus } from "@/types";
import type { PlaylistSummary, Video } from "@/types";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const routerState = vi.hoisted(() => ({
  tab: undefined as "playlists" | undefined,
  navigate: vi.fn(),
}));

vi.mock("@caffeineai/core-infrastructure", () => ({
  useActor: () => ({ actor: {}, isFetching: false }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ principal: null }),
}));

// The SubscribeButton pulls in useSubscription, which needs the full
// react-query + actor stack. Stub it so the channel page renders cleanly.
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({
    isSubscribed: false,
    subscriberCount: 0n,
    isPending: false,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ userId: "aaaaa-aa" }),
  useSearch: () => ({ tab: routerState.tab }),
  useNavigate: () => routerState.navigate,
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/">{children}</a>
  ),
}));

const useQueryMock = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: unknown) => useQueryMock(options),
}));

// Mock the infinite-scroll hook to control the channel's video list.
const useInfiniteVideosMock = vi.fn();
vi.mock("@/hooks/useInfiniteVideos", () => ({
  useInfiniteVideos: (options: unknown) => useInfiniteVideosMock(options),
}));

const useInfinitePlaylistsMock = vi.fn();
vi.mock("@/hooks/useInfinitePlaylists", () => ({
  useInfinitePlaylists: (options: unknown) => useInfinitePlaylistsMock(options),
}));

function makeVideo(id: bigint, title: string): Video {
  return {
    id,
    title,
    status: VideoStatus.published,
    ownerId: "aaaaa-aa" as unknown as Video["ownerId"],
    createdAt: 0n,
    publishedAt: 1n,
    video: ExternalBlob.fromURL(`https://example.com/video-${id}`),
    filename: `video-${id}.mp4`,
    mimeType: "video/mp4",
    fileSize: 100n,
    viewCount: 0n,
    isPrivate: false,
  };
}

function makePlaylist(id: bigint, title: string): PlaylistSummary {
  return {
    id,
    title,
    ownerId: "aaaaa-aa" as unknown as PlaylistSummary["ownerId"],
    videoCount: 2n,
    firstVideoId: 2n,
    isPrivate: false,
    createdAt: 0n,
    updatedAt: 1n,
  };
}

describe("ChannelPage", () => {
  beforeEach(() => {
    routerState.tab = undefined;
    routerState.navigate.mockReset();
    useQueryMock.mockReset();
    useInfiniteVideosMock.mockReset();
    useInfinitePlaylistsMock.mockReset();
    useInfinitePlaylistsMock.mockReturnValue({
      items: [],
      hasMore: false,
      loadMore: vi.fn(),
      reset: vi.fn(),
      isLoading: false,
      error: null,
    });
  });

  it("renders the channel header and its published videos", async () => {
    useQueryMock.mockReturnValue({
      data: {
        displayName: "Ada",
        username: "ada",
        bio: "Hello",
        createdAt: 0n,
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    useInfiniteVideosMock.mockReturnValue({
      items: [makeVideo(2n, "Second"), makeVideo(1n, "First")],
      hasMore: false,
      loadMore: vi.fn(),
      reset: vi.fn(),
      isLoading: false,
      error: null,
      sentinelRef: { current: null },
    });

    render(<ChannelPage />);

    expect(
      await screen.findByRole("heading", { name: "Ada" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText((content) => content.includes("@ada")),
    ).toBeInTheDocument();
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
    expect(screen.getByText("First")).toBeInTheDocument();
  });

  it("shows an empty state when the channel has no videos", async () => {
    useQueryMock.mockReturnValue({
      data: { displayName: "Ada", username: "ada", createdAt: 0n },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    useInfiniteVideosMock.mockReturnValue({
      items: [],
      hasMore: false,
      loadMore: vi.fn(),
      reset: vi.fn(),
      isLoading: false,
      error: null,
      sentinelRef: { current: null },
    });

    render(<ChannelPage />);

    expect(await screen.findByText("No videos yet")).toBeInTheDocument();
  });

  it("uses URL-backed tabs and renders channel playlists", async () => {
    routerState.tab = "playlists";
    useQueryMock.mockReturnValue({
      data: { displayName: "Ada", username: "ada", createdAt: 0n },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useInfiniteVideosMock.mockReturnValue({
      items: [],
      hasMore: false,
      loadMore: vi.fn(),
      reset: vi.fn(),
      isLoading: false,
      error: null,
    });
    useInfinitePlaylistsMock.mockReturnValue({
      items: [makePlaylist(4n, "Road trip")],
      hasMore: false,
      loadMore: vi.fn(),
      reset: vi.fn(),
      isLoading: false,
      error: null,
    });

    render(<ChannelPage />);

    expect(
      await screen.findByRole("tab", { name: "Playlists" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Road trip")).toBeInTheDocument();
    expect(useInfiniteVideosMock.mock.calls[0][0]).toMatchObject({
      enabled: false,
    });
    expect(useInfinitePlaylistsMock.mock.calls[0][0]).toMatchObject({
      enabled: true,
    });
  });

  it("navigates to the playlists tab", async () => {
    const user = userEvent.setup();
    useQueryMock.mockReturnValue({
      data: { displayName: "Ada", username: "ada", createdAt: 0n },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useInfiniteVideosMock.mockReturnValue({
      items: [],
      hasMore: false,
      loadMore: vi.fn(),
      reset: vi.fn(),
      isLoading: false,
      error: null,
    });

    render(<ChannelPage />);
    await user.click(screen.getByRole("tab", { name: "Playlists" }));

    expect(routerState.navigate).toHaveBeenCalledWith({
      to: "/channel/$userId",
      params: { userId: "aaaaa-aa" },
      search: { tab: "playlists" },
    });
  });
});
