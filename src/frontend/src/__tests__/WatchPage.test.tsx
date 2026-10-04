import { ExternalBlob } from "@/backend";
import { WatchPage } from "@/pages/WatchPage";
import { VideoStatus } from "@/types";
import type { PlaylistView, Video } from "@/types";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const routerState = vi.hoisted(() => ({
  list: undefined as string | undefined,
  navigate: vi.fn(),
}));

const authState = vi.hoisted(() => ({
  principal: null as string | null,
  isAuthenticated: false,
  login: vi.fn(),
}));

// Mock the actor infrastructure and auth hooks.
vi.mock("@caffeineai/core-infrastructure", () => ({
  useActor: () => ({ actor: {}, isFetching: false }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => authState,
}));

vi.mock("@/services/hooks", () => ({
  useAuth: () => authState,
}));

// The SubscribeButton pulls in useSubscription, which needs the full
// react-query + actor stack. Stub it so the watch page renders cleanly.
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({
    isSubscribed: false,
    subscriberCount: 0n,
    isPending: false,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  }),
}));

// Mock the router hooks used by the watch page.
vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ videoId: "1" }),
  useSearch: () => ({ list: routerState.list }),
  useNavigate: () => routerState.navigate,
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/">{children}</a>
  ),
}));

// Mock react-query's useQuery to control the video and channel data.
const useQueryMock = vi.fn();
const queryClient = {
  setQueryData: vi.fn(),
  invalidateQueries: vi.fn(async () => undefined),
};
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: unknown) => useQueryMock(options),
  useQueryClient: () => queryClient,
}));

function makePublishedVideo(id = 1n, title = "My published clip"): Video {
  return {
    id,
    title,
    status: VideoStatus.published,
    ownerId: "aaaaa-aa" as unknown as Video["ownerId"],
    createdAt: 0n,
    publishedAt: 1n,
    video: ExternalBlob.fromURL("https://example.com/video"),
    filename: "clip.mp4",
    mimeType: "video/mp4",
    fileSize: 100n,
    viewCount: 7n,
    isPrivate: false,
    description: "A great description",
  };
}

function makePlaylistView(videos: Video[]): PlaylistView {
  return {
    playlist: {
      id: 5n,
      title: "Road trip",
      ownerId: "aaaaa-aa" as unknown as PlaylistView["playlist"]["ownerId"],
      videoCount: BigInt(videos.length),
      firstVideoId: videos[0]?.id,
      isPrivate: false,
      createdAt: 0n,
      updatedAt: 1n,
    },
    videos,
  };
}

describe("WatchPage", () => {
  beforeEach(() => {
    routerState.list = undefined;
    routerState.navigate.mockReset();
    authState.principal = null;
    authState.isAuthenticated = false;
    authState.login.mockReset();
    queryClient.setQueryData.mockReset();
    queryClient.invalidateQueries.mockReset();
    useQueryMock.mockReset();
  });

  it("renders a published video with its title, description, and player", async () => {
    const video = makePublishedVideo();
    useQueryMock.mockImplementation((options: { queryKey: string[] }) => {
      if (options.queryKey[0] === "video") {
        return {
          data: video,
          isLoading: false,
          isError: false,
          refetch: vi.fn(),
        };
      }
      // channel query
      return {
        data: { displayName: "Ada", username: "ada", createdAt: 0n },
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      };
    });

    render(<WatchPage />);

    expect(await screen.findByText("My published clip")).toBeInTheDocument();
    expect(screen.getByText("A great description")).toBeInTheDocument();
    expect(screen.getByTestId("video_element")).toHaveAttribute(
      "src",
      "https://example.com/video",
    );
    expect(screen.getByTestId("video_element")).toHaveAttribute("autoplay");
    expect(screen.getByTestId("video_element")).toHaveProperty("muted", true);
    expect(screen.getByText("Loading video…")).toBeInTheDocument();
    fireEvent.canPlay(screen.getByTestId("video_element"));
    expect(screen.queryByText("Loading video…")).not.toBeInTheDocument();
    expect(screen.getByTestId("video_views")).toHaveTextContent("7 views");
    expect(screen.getByTestId("video_actions")).toBeInTheDocument();
    expect(screen.getByTestId("save_to_playlist_button")).toBeInTheDocument();
  });

  it("shows an unavailable state for a non-published video", async () => {
    const draft = { ...makePublishedVideo(), status: VideoStatus.draft };
    useQueryMock.mockImplementation((options: { queryKey: string[] }) => {
      if (options.queryKey[0] === "video") {
        return {
          data: draft,
          isLoading: false,
          isError: false,
          refetch: vi.fn(),
        };
      }
      return { data: null, isLoading: false, isError: false, refetch: vi.fn() };
    });

    render(<WatchPage />);

    expect(await screen.findByText("Video unavailable")).toBeInTheDocument();
  });

  it("renders a missing profile as an unclickable Anonymous channel", async () => {
    const video = makePublishedVideo();
    useQueryMock.mockImplementation((options: { queryKey: string[] }) => {
      if (options.queryKey[0] === "video") {
        return {
          data: video,
          isLoading: false,
          isError: false,
          refetch: vi.fn(),
        };
      }
      return { data: null, isLoading: false, isError: false, refetch: vi.fn() };
    });

    render(<WatchPage />);

    expect(await screen.findByTestId("anonymous_channel")).toHaveTextContent(
      "Anonymous",
    );
    expect(screen.queryByTestId("channel_link")).not.toBeInTheDocument();
    expect(screen.queryByText("Subscribe")).not.toBeInTheDocument();
  });

  it("renders a playlist queue and advances when playback ends", async () => {
    routerState.list = "5";
    const video = makePublishedVideo();
    const nextVideo = makePublishedVideo(2n, "The next clip");
    const playlistView = makePlaylistView([video, nextVideo]);
    useQueryMock.mockImplementation(
      (options: { queryKey: readonly string[] }) => {
        switch (options.queryKey[0]) {
          case "video":
            return {
              data: video,
              isLoading: false,
              isError: false,
              refetch: vi.fn(),
            };
          case "playlist":
            return {
              data: playlistView,
              isLoading: false,
              isError: false,
              refetch: vi.fn(),
            };
          case "channel":
            return {
              data: { displayName: "Ada", username: "ada", createdAt: 0n },
              isLoading: false,
              isError: false,
              refetch: vi.fn(),
            };
          default:
            return {
              data: [],
              isLoading: false,
              isError: false,
              refetch: vi.fn(),
            };
        }
      },
    );

    render(<WatchPage />);

    expect(await screen.findByTestId("playlist_queue")).toHaveAccessibleName(
      "Playlist: Road trip",
    );
    expect(screen.getByText("The next clip")).toBeInTheDocument();

    fireEvent.ended(screen.getByTestId("video_element"));

    expect(routerState.navigate).toHaveBeenCalledWith({
      to: "/watch/$videoId",
      params: { videoId: "2" },
      search: { list: "5", index: 2 },
    });
  });

  it("can disable autoplay and dismiss the playlist context", async () => {
    const user = userEvent.setup();
    routerState.list = "5";
    const video = makePublishedVideo();
    const playlistView = makePlaylistView([
      video,
      makePublishedVideo(2n, "The next clip"),
    ]);
    useQueryMock.mockImplementation(
      (options: { queryKey: readonly string[] }) => {
        if (options.queryKey[0] === "video") {
          return {
            data: video,
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
          };
        }
        if (options.queryKey[0] === "playlist") {
          return {
            data: playlistView,
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
          };
        }
        if (options.queryKey[0] === "channel") {
          return {
            data: { displayName: "Ada", username: "ada", createdAt: 0n },
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
          };
        }
        return {
          data: [],
          isLoading: false,
          isError: false,
          refetch: vi.fn(),
        };
      },
    );

    render(<WatchPage />);

    await user.click(await screen.findByRole("checkbox", { name: "Autoplay" }));
    fireEvent.ended(screen.getByTestId("video_element"));
    expect(routerState.navigate).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Close playlist" }));
    expect(routerState.navigate).toHaveBeenCalledWith({
      to: "/watch/$videoId",
      params: { videoId: "1" },
      search: {},
    });
  });
});
