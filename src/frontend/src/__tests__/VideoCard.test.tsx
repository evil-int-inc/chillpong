import { ExternalBlob } from "@/backend";
import { VideoCard } from "@/components/video/VideoCard";
import { VideoStatus } from "@/types";
import type { Video } from "@/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@caffeineai/core-infrastructure", () => ({
  useActor: () => ({ actor: {}, isFetching: false }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: null, isLoading: false }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: React.ComponentProps<"a">) => (
    <a href="/" {...props}>
      {children}
    </a>
  ),
}));

function makeVideo(): Video {
  return {
    id: 1n,
    title: "Anonymous upload",
    status: VideoStatus.published,
    ownerId: "aaaaa-aa" as unknown as Video["ownerId"],
    video: ExternalBlob.fromURL("https://example.com/video"),
    createdAt: 0n,
    filename: "clip.mp4",
    mimeType: "video/mp4",
    fileSize: 100n,
    viewCount: 12n,
    isPrivate: false,
  };
}

describe("VideoCard", () => {
  it("shows a missing profile as Anonymous without a channel link", () => {
    const { container } = render(<VideoCard video={makeVideo()} />);

    expect(container.querySelector(".aura.text-brand")).toBeInTheDocument();
    expect(screen.getByTestId("video_card")).toHaveClass("rounded-xl");
    expect(screen.getByTestId("anonymous_channel")).toHaveTextContent(
      "Anonymous",
    );
    expect(screen.queryByTestId("channel_link")).not.toBeInTheDocument();
    expect(screen.getByTestId("video_views")).toHaveTextContent("12 views");
    expect(screen.getByTestId("video_actions")).toBeInTheDocument();
    expect(screen.getByTestId("download_video_button")).toBeInTheDocument();
    expect(screen.getByTestId("download_preview_button")).toBeDisabled();
    expect(screen.getByTestId("copy_title_button")).toBeInTheDocument();
    expect(screen.getByTestId("copy_description_button")).toBeDisabled();
  });

  it("uses the uploaded preview's direct URL for the thumbnail", () => {
    const video = {
      ...makeVideo(),
      thumbnail: ExternalBlob.fromURL("https://example.com/preview"),
    };
    const { container } = render(<VideoCard video={video} />);

    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://example.com/preview",
    );
  });
});
