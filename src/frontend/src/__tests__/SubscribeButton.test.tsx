import { SubscribeButton } from "@/components/subscription/SubscribeButton";
import { useSubscription } from "@/hooks/useSubscription";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: vi.fn(),
}));

const mockUseSubscription = vi.mocked(useSubscription);

describe("SubscribeButton", () => {
  it("shows Subscribe and subscribes when not subscribed", async () => {
    const user = userEvent.setup();
    const subscribe = vi.fn();
    const unsubscribe = vi.fn();
    mockUseSubscription.mockReturnValue({
      isSubscribed: false,
      subscriberCount: 5n,
      isPending: false,
      subscribe,
      unsubscribe,
    });

    render(<SubscribeButton channelId="aaaaa-aa" />);

    const button = screen.getByText("Subscribe");
    await user.click(button);
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(unsubscribe).not.toHaveBeenCalled();
  });

  it("shows Subscribed and unsubscribes when subscribed", async () => {
    const user = userEvent.setup();
    const subscribe = vi.fn();
    const unsubscribe = vi.fn();
    mockUseSubscription.mockReturnValue({
      isSubscribed: true,
      subscriberCount: 5n,
      isPending: false,
      subscribe,
      unsubscribe,
    });

    render(<SubscribeButton channelId="aaaaa-aa" />);

    const button = screen.getByText("Subscribed");
    await user.click(button);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("is hidden on your own channel", () => {
    mockUseSubscription.mockReturnValue({
      isSubscribed: false,
      subscriberCount: 5n,
      isPending: false,
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    });

    render(<SubscribeButton channelId="aaaaa-aa" hidden />);

    expect(screen.queryByText("Subscribe")).not.toBeInTheDocument();
    expect(screen.queryByText("Subscribed")).not.toBeInTheDocument();
  });
});
