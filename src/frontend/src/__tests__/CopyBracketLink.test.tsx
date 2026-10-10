import { type Tournament, TournamentFormat, TournamentStatus } from "@/backend";
import { CopyBracketLink } from "@/components/tournaments/CopyBracketLink";
import { setLanguage } from "@/i18n";
import { TournamentsPage } from "@/pages/TournamentsPage";
import { bracketPath, bracketUrl } from "@/types/bracket-link";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  actor: { getTournaments: vi.fn() },
}));

vi.mock("@caffeineai/core-infrastructure", () => ({
  useActor: () => ({ actor: state.actor, isFetching: false }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ isAdmin: false }),
}));

function tournament(id: bigint, title: string): Tournament {
  const date = BigInt(Date.parse("2026-10-10T17:00:00Z")) * 1_000_000n;
  return {
    id,
    title,
    description: "Bring your paddle",
    venue: "ChillPong Bar",
    startsAt: date,
    format: TournamentFormat.singles,
    capacity: 16n,
    status: TournamentStatus.upcoming,
    createdAt: date,
    updatedAt: date,
  };
}

function renderBoard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TournamentsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  setLanguage("en");
  state.actor.getTournaments.mockReset();
  state.actor.getTournaments.mockResolvedValue([
    tournament(0n, "Warehouse Cup"),
    tournament(8n, "Basement Rally"),
  ]);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("shareable full bracket links", () => {
  it("uses the same-origin full bracket URL, including tournament zero", () => {
    expect(bracketPath(0n)).toBe("/tournaments/0?view=bracket");
    expect(bracketUrl("8", "https://chillpong.caffeine.xyz")).toBe(
      "https://chillpong.caffeine.xyz/tournaments/8?view=bracket",
    );
  });

  it("copies the tournament card URL without opening details or navigating", async () => {
    const user = userEvent.setup();
    const write = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue();
    const currentLocation = window.location.href;
    renderBoard();

    const card = (
      await screen.findByRole("button", { name: "Warehouse Cup" })
    ).closest("li")!;
    await user.click(
      within(card).getByRole("button", { name: "Copy bracket link" }),
    );

    expect(write).toHaveBeenCalledWith(
      `${window.location.origin}/tournaments/0?view=bracket`,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(window.location.href).toBe(currentLocation);
    expect(within(card).getByRole("status")).toHaveTextContent(
      "Bracket link copied",
    );
  });

  it("copies the selected tournament URL from its details modal", async () => {
    const user = userEvent.setup();
    const write = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue();
    renderBoard();
    await user.click(
      await screen.findByRole("button", { name: "Details for Basement Rally" }),
    );
    const dialog = screen.getByRole("dialog");

    await user.click(
      within(dialog).getByRole("button", { name: "Copy bracket link" }),
    );

    expect(write).toHaveBeenCalledWith(
      `${window.location.origin}/tournaments/8?view=bracket`,
    );
    expect(dialog).toHaveAttribute("open");
    expect(within(dialog).getByRole("status")).toHaveTextContent(
      "Bracket link copied",
    );
  });

  it("shows a selectable URL when permission to write the clipboard is rejected", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new DOMException("Clipboard denied", "NotAllowedError"),
    );
    render(<CopyBracketLink tournamentId={0n} />);

    await user.click(screen.getByRole("button", { name: "Copy bracket link" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not copy the link. Copy it below.",
    );
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    const input = screen.getByRole("textbox", {
      name: "Full bracket URL",
    }) as HTMLInputElement;
    expect(input).toHaveValue(
      `${window.location.origin}/tournaments/0?view=bracket`,
    );
    expect(input).toHaveAttribute("readonly");
    await user.click(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
  });

  it("provides the same manual fallback when the Clipboard API is unavailable", async () => {
    const user = userEvent.setup();
    const clipboard = navigator.clipboard;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    try {
      render(<CopyBracketLink tournamentId={8n} />);
      await user.click(
        screen.getByRole("button", { name: "Copy bracket link" }),
      );
      expect(
        screen.getByRole("textbox", { name: "Full bracket URL" }),
      ).toHaveValue(`${window.location.origin}/tournaments/8?view=bracket`);
      expect(screen.getByRole("status")).toBeEmptyDOMElement();
    } finally {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: clipboard,
      });
    }
  });

  it("announces icon-only copy success and resets the confirmation", async () => {
    userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    vi.useFakeTimers();
    const outerClick = vi.fn();
    render(
      <div onClick={outerClick} onKeyDown={outerClick}>
        <CopyBracketLink tournamentId={0n} compact />
      </div>,
    );
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Copy bracket link" }),
      );
    });
    expect(outerClick).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Bracket link copied");
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(screen.getByRole("button")).toHaveAttribute(
      "title",
      "Copy bracket link",
    );
  });

  it("does not show an old tournament's copy result after switching tournaments", async () => {
    const user = userEvent.setup();
    let resolveCopy: () => void = () => {};
    vi.spyOn(navigator.clipboard, "writeText").mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveCopy = resolve;
        }),
    );
    const view = render(<CopyBracketLink tournamentId={0n} />);
    await user.click(screen.getByRole("button", { name: "Copy bracket link" }));
    view.rerender(<CopyBracketLink tournamentId={8n} />);
    await act(async () => resolveCopy());
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(
      screen.getByRole("button", { name: "Copy bracket link" }),
    ).toBeEnabled();
  });
});
