import { UploadForm } from "@/components/upload/UploadForm";
import type { Playlist } from "@/types";
import type { Principal } from "@icp-sdk/core/principal";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createObjectURL = vi.fn(() => "blob:video-preview");
const revokeObjectURL = vi.fn();

beforeEach(() => {
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: createObjectURL,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: revokeObjectURL,
  });
});

function makeVideoFile(size = 100, type = "video/mp4"): File {
  return new File([new Uint8Array(size)], "clip.mp4", { type });
}

function makePlaylist(id: bigint, title: string): Playlist {
  return {
    id,
    title,
    ownerId: "aaaaa-aa" as unknown as Principal,
    videoIds: [],
    isPrivate: false,
    createdAt: 0n,
    updatedAt: 0n,
  };
}

describe("UploadForm", () => {
  it("requires a title and a video before submitting", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<UploadForm onSubmit={onSubmit} />);

    await user.click(screen.getByText("Upload video"));

    expect(screen.getByText("Title is required.")).toBeInTheDocument();
    expect(screen.getByText("Choose a video to upload.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects an unsupported video format", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<UploadForm onSubmit={onSubmit} />);

    // fireEvent.change bypasses the input's `accept` filter, so an
    // unsupported type reaches the validation logic.
    const videoInput = screen.getByTestId("video_input");
    fireEvent.change(videoInput, {
      target: { files: [makeVideoFile(100, "text/plain")] },
    });

    await user.type(screen.getByTestId("title_input"), "My clip");
    await user.click(screen.getByText("Upload video"));

    expect(
      screen.getByText("Unsupported video format. Use MP4, WebM, or MOV."),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits the selected file, title, and description", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<UploadForm onSubmit={onSubmit} />);

    const videoInput = screen.getByTestId("video_input");
    await user.upload(videoInput, makeVideoFile());

    expect(await screen.findByTestId("video_preview")).toHaveAttribute(
      "src",
      "blob:video-preview",
    );

    await user.type(screen.getByTestId("title_input"), "My clip");
    await user.type(
      screen.getByTestId("description_textarea"),
      "A description",
    );

    await user.click(screen.getByText("Upload video"));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const values = onSubmit.mock.calls[0][0];
    expect(values.title).toBe("My clip");
    expect(values.description).toBe("A description");
    expect(values.file.name).toBe("clip.mp4");
    expect(values.isPrivate).toBe(false);
    expect(values.playlist).toBeNull();
  });

  it("submits private visibility when selected", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<UploadForm onSubmit={onSubmit} />);

    await user.upload(screen.getByTestId("video_input"), makeVideoFile());
    await user.type(screen.getByTestId("title_input"), "Private clip");
    await user.click(screen.getByTestId("private_checkbox"));
    await user.click(screen.getByText("Upload video"));

    expect(onSubmit.mock.calls[0][0].isPrivate).toBe(true);
  });

  it("submits an existing playlist selection", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <UploadForm
        onSubmit={onSubmit}
        playlists={[makePlaylist(12n, "Favorites")]}
      />,
    );

    await user.upload(screen.getByTestId("video_input"), makeVideoFile());
    await user.type(screen.getByTestId("title_input"), "Playlist clip");
    await user.selectOptions(
      screen.getByLabelText("Add video to playlist"),
      "existing:12",
    );
    await user.click(screen.getByText("Upload video"));

    expect(onSubmit.mock.calls[0][0].playlist).toEqual({
      __kind__: "existing",
      existing: 12n,
    });
  });

  it("creates a trimmed private playlist selection inline", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<UploadForm onSubmit={onSubmit} />);

    await user.upload(screen.getByTestId("video_input"), makeVideoFile());
    await user.type(screen.getByTestId("title_input"), "Playlist clip");
    await user.selectOptions(
      screen.getByLabelText("Add video to playlist"),
      "new",
    );
    await user.click(screen.getByText("Upload video"));

    expect(screen.getByText("Playlist name is required.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    await user.type(
      screen.getByTestId("new_playlist_title_input"),
      "  Road trip  ",
    );
    await user.click(screen.getByTestId("new_playlist_private_checkbox"));
    await user.click(screen.getByText("Upload video"));

    expect(onSubmit.mock.calls[0][0].playlist).toEqual({
      __kind__: "new",
      new: { title: "Road trip", isPrivate: true },
    });
  });
});
