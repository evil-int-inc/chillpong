import { Avatar, UserAvatar } from "@/components/ui/Avatar";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("shared user avatars", () => {
  it("uses a Telegram photo with DaisyUI avatar markup and the user's name", () => {
    const page = render(
      <UserAvatar
        user={{
          displayName: "Nino Beridze",
          username: "nino",
          avatarUrl: "https://t.me/i/userpic/320/nino.jpg",
        }}
        size="sm"
      />,
    );
    const image = screen.getByRole("img", { name: "Nino Beridze" });
    expect(image).toHaveAttribute("src", "https://t.me/i/userpic/320/nino.jpg");
    expect(image).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(page.container.firstElementChild).toHaveClass("avatar", "size-8");
    expect(image.parentElement?.parentElement).toHaveClass("avatar");
  });

  it("prefers the Telegram URL and preserves legacy stored avatars", () => {
    const page = render(
      <UserAvatar
        user={{
          username: "nino",
          avatar: { getDirectURL: () => "blob:https://chillpong.test/stored" },
        }}
      />,
    );
    expect(screen.getByRole("img", { name: "nino" })).toHaveAttribute(
      "src",
      "blob:https://chillpong.test/stored",
    );
    page.rerender(
      <UserAvatar
        user={{
          username: "nino",
          avatarUrl: "https://t.me/i/userpic/320/nino.jpg",
          avatar: { getDirectURL: () => "blob:https://chillpong.test/stored" },
        }}
      />,
    );
    expect(screen.getByRole("img", { name: "nino" })).toHaveAttribute(
      "src",
      "https://t.me/i/userpic/320/nino.jpg",
    );
  });

  it("falls back to initials after a photo fails and renders a new photo after relinking", () => {
    const page = render(
      <UserAvatar
        user={{ avatarUrl: "https://t.me/i/userpic/320/old.jpg" }}
        name="Nino Beridze"
        alt="Nino's avatar"
      />,
    );
    fireEvent.error(screen.getByRole("img", { name: "Nino's avatar" }));
    const fallback = screen.getByRole("img", { name: "Nino's avatar" });
    expect(fallback).not.toHaveAttribute("src");
    expect(fallback).toHaveClass("avatar-placeholder");
    expect(fallback).toHaveTextContent("NB");
    page.rerender(
      <UserAvatar
        user={{ avatarUrl: "https://t.me/i/userpic/320/new.jpg" }}
        name="Nino Beridze"
        alt="Nino's avatar"
      />,
    );
    expect(screen.getByRole("img", { name: "Nino's avatar" })).toHaveAttribute(
      "src",
      "https://t.me/i/userpic/320/new.jpg",
    );
  });

  it.each([
    undefined,
    "",
    "http://insecure.example/avatar.jpg",
    "javascript:alert(1)",
    "file:///avatar.jpg",
  ])("uses accessible initials for unavailable photo %s", (src) => {
    render(<Avatar src={src} name="  ნინო   ბერიძე  " />);
    expect(screen.getByRole("img", { name: "ნინო ბერიძე" })).toHaveTextContent(
      "ნბ".toUpperCase(),
    );
    expect(document.querySelector("img")).toBeNull();
  });

  it("uses a fallback icon for unnamed members and allows decorative avatars", () => {
    const page = render(<UserAvatar user={null} alt="Member avatar" />);
    expect(screen.getByRole("img", { name: "Member avatar" })).toContainElement(
      page.container.querySelector("svg"),
    );
    page.rerender(<UserAvatar name="Nino" alt="" />);
    expect(screen.queryByRole("img")).toBeNull();
  });
});
