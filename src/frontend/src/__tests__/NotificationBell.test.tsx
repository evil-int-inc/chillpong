import { NotificationBell } from "@/components/common/NotificationBell";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/hooks", () => ({
  useNotifications: () => ({
    unreadCount: 0n,
    notifications: [],
    notificationsLoading: false,
    markAllRead: { mutate: vi.fn(), isPending: false },
  }),
}));

describe("NotificationBell", () => {
  it("toggles its popup closed when the bell is clicked again", async () => {
    const user = userEvent.setup();
    render(<NotificationBell />);

    const bell = screen.getByTestId("notification_bell");
    await user.click(bell);
    expect(screen.getByTestId("notification_dropdown")).toBeInTheDocument();
    expect(bell).toHaveAttribute("aria-expanded", "true");

    await user.click(bell);
    expect(
      screen.queryByTestId("notification_dropdown"),
    ).not.toBeInTheDocument();
    expect(bell).toHaveAttribute("aria-expanded", "false");
  });
});
