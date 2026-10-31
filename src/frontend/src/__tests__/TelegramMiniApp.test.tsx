import { BracketGraph } from "@/components/tournaments/BracketGraph";
import {
  type TelegramMiniAppApi,
  TelegramMiniAppService,
  telegramMiniAppService,
} from "@/services/telegram-mini-app.service";
import type {
  TournamentMatchView,
  TournamentPlayerView,
} from "@/types/tournament-manager";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function miniApp(enabled = true, version = "8.0") {
  const app: TelegramMiniAppApi = {
    version,
    platform: "ios",
    isVerticalSwipesEnabled: enabled,
    disableVerticalSwipes: vi.fn(() => {
      app.isVerticalSwipesEnabled = false;
    }),
    enableVerticalSwipes: vi.fn(() => {
      app.isVerticalSwipesEnabled = true;
    }),
  };
  return app;
}
beforeEach(() => {
  window.Telegram = undefined;
  window.TelegramWebviewProxy = undefined;
  window.history.replaceState(null, "", "/tournaments/0");
});
afterEach(() => {
  cleanup();
  window.Telegram = undefined;
  window.TelegramWebviewProxy = undefined;
  window.history.replaceState(null, "", "/");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Telegram bracket swipe policy", () => {
  it("does nothing in an ordinary browser", () => {
    const send = vi.spyOn(window, "postMessage");
    const service = new TelegramMiniAppService();
    expect(service.isInTelegramMiniApp()).toBe(false);
    const release = service.protectBracketGestures();
    release();
    release();
    expect(send).not.toHaveBeenCalled();
    expect(window.Telegram).toBeUndefined();
  });

  it("does not treat a WebApp SDK loaded in an ordinary browser as an active Mini App", () => {
    const app = { ...miniApp(), platform: "unknown" };
    window.Telegram = { WebApp: app };
    const service = new TelegramMiniAppService();
    expect(service.isInTelegramMiniApp()).toBe(false);
    service.protectBracketGestures()();
    expect(app.disableVerticalSwipes).not.toHaveBeenCalled();
    expect(app.enableVerticalSwipes).not.toHaveBeenCalled();
  });

  it("does not treat Telegram login or its native browser bridge alone as a Mini App", () => {
    const postEvent = vi.fn();
    window.TelegramWebviewProxy = { postEvent };
    window.Telegram = { Login: { auth: vi.fn(), close: vi.fn() } };
    const service = new TelegramMiniAppService();
    expect(service.isInTelegramMiniApp()).toBe(false);
    service.protectBracketGestures()();
    expect(postEvent).not.toHaveBeenCalled();
  });

  it("ignores a generic browser notify hook without Telegram launch metadata", () => {
    const notify = vi.fn();
    vi.stubGlobal("external", { notify });
    const service = new TelegramMiniAppService();
    expect(service.isInTelegramMiniApp()).toBe(false);
    service.protectBracketGestures()();
    expect(notify).not.toHaveBeenCalled();
  });

  it.each(["", "#tgWebAppVersion=8.0"])(
    "ignores an unrelated iframe with incomplete launch metadata: %s",
    (hash) => {
      window.history.replaceState(null, "", `/tournaments/0${hash}`);
      const postMessage = vi.fn();
      vi.stubGlobal("parent", { postMessage });
      const service = new TelegramMiniAppService();
      expect(service.isInTelegramMiniApp()).toBe(false);
      service.protectBracketGestures()();
      expect(postMessage).not.toHaveBeenCalled();
    },
  );

  it("ignores copied launch parameters in a top-level browser without a Telegram host", () => {
    window.history.replaceState(
      null,
      "",
      "/tournaments/0#tgWebAppVersion=8.0&tgWebAppPlatform=android",
    );
    const service = new TelegramMiniAppService();
    expect(service.isInTelegramMiniApp()).toBe(false);
    expect(window.Telegram).toBeUndefined();
  });

  it("disables host swipes while a bracket is active and restores them only after the last bracket leaves", () => {
    const app = miniApp();
    window.Telegram = { WebApp: app };
    const service = new TelegramMiniAppService();
    expect(service.isInTelegramMiniApp()).toBe(true);
    const first = service.protectBracketGestures();
    const second = service.protectBracketGestures();
    expect(app.disableVerticalSwipes).toHaveBeenCalledOnce();
    expect(app.isVerticalSwipesEnabled).toBe(false);
    first();
    first();
    expect(app.enableVerticalSwipes).not.toHaveBeenCalled();
    second();
    second();
    expect(app.enableVerticalSwipes).toHaveBeenCalledOnce();
    expect(app.isVerticalSwipesEnabled).toBe(true);
  });

  it("preserves a swipe policy that was already disabled before entering the bracket", () => {
    const app = miniApp(false);
    window.Telegram = { WebApp: app };
    new TelegramMiniAppService().protectBracketGestures()();
    expect(app.disableVerticalSwipes).not.toHaveBeenCalled();
    expect(app.enableVerticalSwipes).not.toHaveBeenCalled();
    expect(app.isVerticalSwipesEnabled).toBe(false);
  });

  it("uses Telegram's native transport without replacing the existing login or event handlers", () => {
    window.history.replaceState(
      null,
      "",
      "/tournaments/0#tgWebAppVersion=7.10&tgWebAppPlatform=android",
    );
    const postEvent = vi.fn();
    window.TelegramWebviewProxy = { postEvent };
    const telegram = {
      Login: { auth: vi.fn(), close: vi.fn() },
      WebView: { receiveEvent: vi.fn() },
    };
    window.Telegram = telegram;
    const release = new TelegramMiniAppService().protectBracketGestures();
    expect(postEvent).toHaveBeenCalledExactlyOnceWith(
      "web_app_setup_swipe_behavior",
      '{"allow_vertical_swipe":false}',
    );
    expect(window.Telegram).toBe(telegram);
    expect(telegram.Login.auth).not.toHaveBeenCalled();
    expect(telegram.Login.close).not.toHaveBeenCalled();
    expect(telegram.WebView.receiveEvent).not.toHaveBeenCalled();
    release();
    expect(postEvent).toHaveBeenLastCalledWith(
      "web_app_setup_swipe_behavior",
      '{"allow_vertical_swipe":true}',
    );
  });

  it("supports the desktop notify transport", () => {
    window.history.replaceState(
      null,
      "",
      "/tournaments/0#tgWebAppVersion=8.0&tgWebAppPlatform=tdesktop",
    );
    const notify = vi.fn();
    vi.stubGlobal("external", { notify });
    const release = new TelegramMiniAppService().protectBracketGestures();
    expect(JSON.parse(notify.mock.calls[0][0])).toEqual({
      eventType: "web_app_setup_swipe_behavior",
      eventData: { allow_vertical_swipe: false },
    });
    release();
    expect(
      JSON.parse(notify.mock.calls[1][0]).eventData.allow_vertical_swipe,
    ).toBe(true);
  });

  it("supports Telegram Web after SPA navigation removes the launch hash, with a fixed Telegram target origin", () => {
    window.history.replaceState(
      null,
      "",
      "/tournaments/0#tgWebAppVersion=8.0&tgWebAppPlatform=web",
    );
    const postMessage = vi.fn();
    vi.stubGlobal("parent", { postMessage });
    const service = new TelegramMiniAppService();
    window.history.replaceState(null, "", "/tournaments/0?view=bracket");
    const release = service.protectBracketGestures();
    expect(service.isInTelegramMiniApp()).toBe(true);
    expect(postMessage).toHaveBeenCalledExactlyOnceWith(
      '{"eventType":"web_app_setup_swipe_behavior","eventData":{"allow_vertical_swipe":false}}',
      "https://web.telegram.org",
    );
    release();
    expect(postMessage.mock.calls[1][1]).toBe("https://web.telegram.org");
    expect(
      JSON.parse(postMessage.mock.calls[1][0]).eventData.allow_vertical_swipe,
    ).toBe(true);
  });

  it.each(["7.6", "bad", "7.bad"])(
    "leaves unsupported Telegram client version %s alone",
    (version) => {
      const app = miniApp(true, version);
      const postEvent = vi.fn();
      window.Telegram = { WebApp: app };
      window.TelegramWebviewProxy = { postEvent };
      new TelegramMiniAppService().protectBracketGestures()();
      expect(app.disableVerticalSwipes).not.toHaveBeenCalled();
      expect(postEvent).not.toHaveBeenCalled();
    },
  );

  it("does not interrupt navigation if a host bridge throws during setup or cleanup", () => {
    window.history.replaceState(
      null,
      "",
      "/tournaments/0#tgWebAppVersion=8.0&tgWebAppPlatform=android",
    );
    const postEvent = vi.fn<() => void>(() => {
      throw new Error("Host not available");
    });
    window.TelegramWebviewProxy = { postEvent };
    const service = new TelegramMiniAppService();
    expect(() => service.protectBracketGestures()()).not.toThrow();
    expect(postEvent).toHaveBeenCalledOnce();
    postEvent.mockImplementationOnce(() => {});
    const release = service.protectBracketGestures();
    expect(release).not.toThrow();
  });
});

const match: TournamentMatchView = {
  id: 1n,
  bracket: "winners",
  round: 1,
  position: 1,
  playerAId: 1n,
  playerBId: 2n,
  sourceA: { kind: "player", id: 1n },
  sourceB: { kind: "player", id: 2n },
  status: "ready",
  manualOverride: false,
  prioritized: false,
};
const players: TournamentPlayerView[] = ["Nino", "Giorgi"].map(
  (name, index) => ({
    id: BigInt(index + 1),
    name,
    skill: 2,
    registrationNumber: BigInt(index + 1),
    registeredAt: 0n,
    status: "ready",
    losses: 0,
    manualOverride: false,
  }),
);
function pointer(
  target: HTMLElement,
  type: string,
  id: number,
  x: number,
  y: number,
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
  });
  Object.defineProperties(event, {
    pointerId: { value: id },
    pointerType: { value: "touch" },
    isPrimary: { value: id === 1 },
  });
  fireEvent(target, event);
  return event;
}

describe("Telegram full bracket interaction", () => {
  it("does not activate the service in a regular browser and keeps match controls working", () => {
    const protect = vi.spyOn(telegramMiniAppService, "protectBracketGestures");
    const notify = vi.fn();
    vi.stubGlobal("external", { notify });
    const onSelect = vi.fn();
    render(
      <BracketGraph
        matches={[match]}
        players={players}
        onSelect={onSelect}
        fullscreen
      />,
    );
    expect(protect).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("match.card.1"));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(match);
  });
  it.each([false, true])(
    "scopes the swipe policy to an inline/fullscreen bracket and handles StrictMode cleanup (fullscreen=%s)",
    (fullscreen) => {
      const app = miniApp();
      window.Telegram = { WebApp: app };
      const page = render(
        <StrictMode>
          <BracketGraph
            matches={[match]}
            players={players}
            onSelect={vi.fn()}
            fullscreen={fullscreen}
          />
        </StrictMode>,
      );
      expect(app.isVerticalSwipesEnabled).toBe(false);
      page.rerender(
        <StrictMode>
          <BracketGraph
            matches={[{ ...match }]}
            players={players}
            onSelect={vi.fn()}
            fullscreen={fullscreen}
          />
        </StrictMode>,
      );
      expect(app.isVerticalSwipesEnabled).toBe(false);
      page.unmount();
      expect(app.isVerticalSwipesEnabled).toBe(true);
    },
  );

  it("preserves touch panning, pinch zoom, match taps and the search controls while host swipes are disabled", () => {
    const app = miniApp();
    window.Telegram = { WebApp: app };
    const onSelect = vi.fn();
    render(
      <BracketGraph
        matches={[match]}
        players={players}
        onSelect={onSelect}
        fullscreen
      />,
    );
    const viewport = screen.getByTestId("tournament.bracket");
    const card = screen.getByTestId("match.card.1");
    Object.defineProperties(viewport, {
      clientWidth: { value: 300 },
      clientHeight: { value: 200 },
    });
    viewport.scrollLeft = 100;
    viewport.scrollTop = 100;
    pointer(viewport, "pointerdown", 1, 100, 100);
    const move = pointer(viewport, "pointermove", 1, 80, 70);
    expect(move.defaultPrevented).toBe(true);
    expect(viewport.scrollLeft).toBe(120);
    expect(viewport.scrollTop).toBe(130);
    pointer(viewport, "pointerup", 1, 80, 70);
    pointer(card, "pointerdown", 1, 100, 100);
    pointer(card, "pointerup", 1, 100, 100);
    fireEvent.click(card, { detail: 1 });
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(match);
    pointer(viewport, "pointerdown", 1, 100, 100);
    pointer(viewport, "pointerdown", 2, 200, 100);
    pointer(viewport, "pointermove", 2, 250, 100);
    expect(screen.getByLabelText("Bracket zoom")).toHaveTextContent("150%");
    pointer(viewport, "pointerup", 2, 250, 100);
    pointer(viewport, "pointerup", 1, 100, 100);
    expect(
      screen.getByRole("searchbox", { name: "Find a player in the bracket" }),
    ).toBeVisible();
    expect(app.isVerticalSwipesEnabled).toBe(false);
  });
});
