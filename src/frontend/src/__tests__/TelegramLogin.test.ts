import type { TelegramLoginSdk } from "@/services/telegram-login.service";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const options = {
  client_id: 8851986381,
  nonce: "server-nonce+/=?&",
  scope: ["profile"] as ["profile"],
  lang: "ka",
};
let sdk: TelegramLoginSdk | undefined;

function popupWindow() {
  let closed = false;
  return {
    focus: vi.fn(),
    close: vi.fn(() => {
      closed = true;
    }),
    get closed() {
      return closed;
    },
  };
}

function message(
  source: unknown,
  data: unknown,
  origin = "https://oauth.telegram.org",
) {
  const event = new MessageEvent("message", { data, origin });
  Object.defineProperty(event, "source", { value: source });
  window.dispatchEvent(event);
}

async function browserLogin() {
  const { telegramLoginService } = await import(
    "@/services/telegram-login.service"
  );
  sdk = await telegramLoginService.load();
  return sdk;
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  window.Telegram = undefined;
  window.TelegramWebviewProxy = undefined;
  window.history.replaceState(
    null,
    "",
    "/profile?ignored=query#ignored-fragment",
  );
});
afterEach(() => {
  sdk?.close();
  sdk = undefined;
  for (const script of document.querySelectorAll(
    'script[src*="oauth.telegram.org/js/telegram-login.js"]',
  )) {
    script.remove();
  }
  window.Telegram = undefined;
  window.TelegramWebviewProxy = undefined;
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Telegram browser popup", () => {
  it("opens synchronously with the actual site origin, profile redirect and original server nonce", async () => {
    const popup = popupWindow();
    const open = vi
      .spyOn(window, "open")
      .mockReturnValue(popup as unknown as Window);
    const login = await browserLogin();
    const callback = vi.fn();
    login.auth(options, callback);
    expect(open).toHaveBeenCalledTimes(1);
    const url = new URL(open.mock.calls[0]![0]!.toString());
    expect(url.origin).toBe("https://oauth.telegram.org");
    expect(url.pathname).toBe("/auth");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: "post_message",
      client_id: "8851986381",
      origin: window.location.origin,
      redirect_uri: `${window.location.origin}/profile`,
      scope: "openid profile",
      nonce: options.nonce,
      lang: "ka",
    });
    expect(popup.focus).toHaveBeenCalledOnce();
    expect(callback).not.toHaveBeenCalled();
    expect(
      document.querySelector('script[src*="telegram-login.js"]'),
    ).toBeNull();
  });

  it("uses the corrected browser transport even when an older Telegram SDK is already present", async () => {
    const oldSdk = { auth: vi.fn(), close: vi.fn() };
    window.Telegram = { Login: oldSdk };
    const open = vi
      .spyOn(window, "open")
      .mockReturnValue(popupWindow() as unknown as Window);
    const login = await browserLogin();
    login.auth(options, vi.fn());
    expect(oldSdk.auth).not.toHaveBeenCalled();
    expect(
      new URL(open.mock.calls[0]![0]!.toString()).searchParams.get("origin"),
    ).toBe(window.location.origin);
  });

  it.each([false, true])(
    "forwards only the signed token from the actual Telegram popup (JSON=%s)",
    async (json) => {
      const popup = popupWindow();
      vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
      const login = await browserLogin();
      const callback = vi.fn();
      login.auth(options, callback);
      const data = {
        event: "auth_result",
        result: "signed-token-from-telegram",
        user: { username: "untrusted-claim", id: 1 },
      };
      message(popup, json ? JSON.stringify(data) : data);
      expect(callback).toHaveBeenCalledExactlyOnceWith({
        id_token: "signed-token-from-telegram",
      });
      expect(popup.close).toHaveBeenCalledOnce();
      expect(vi.getTimerCount()).toBe(0);
      message(popup, data);
      expect(callback).toHaveBeenCalledTimes(1);
    },
  );

  it("ignores spoofed origins, other windows, malformed data and unrelated events", async () => {
    const popup = popupWindow();
    vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
    const login = await browserLogin();
    const callback = vi.fn();
    login.auth(options, callback);
    const valid = { event: "auth_result", result: "signed-token" };
    message(popup, valid, "https://oauth.telegram.org.evil.example");
    message(popup, valid, "null");
    message(window, valid);
    message(popup, "invalid JSON");
    message(popup, null);
    message(popup, { event: "other", result: "fake-token" });
    expect(callback).not.toHaveBeenCalled();
    message(popup, valid);
    expect(callback).toHaveBeenCalledExactlyOnceWith({
      id_token: "signed-token",
    });
  });

  it.each([
    [{ event: "auth_result", error: "access_denied" }, "access_denied"],
    [
      { event: "auth_result", user: { username: "unsigned" } },
      "missing_id_token",
    ],
  ])("rejects an unsuccessful Telegram result: %j", async (data, error) => {
    const popup = popupWindow();
    vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
    const login = await browserLogin();
    const callback = vi.fn();
    login.auth(options, callback);
    message(popup, data);
    expect(callback).toHaveBeenCalledExactlyOnceWith({ error });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("reports a user-closed popup once and releases its listener and timer", async () => {
    const popup = popupWindow();
    vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
    const login = await browserLogin();
    const callback = vi.fn();
    login.auth(options, callback);
    popup.close();
    vi.advanceTimersByTime(200);
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_200);
    expect(callback).toHaveBeenCalledExactlyOnceWith({ error: "popup_closed" });
    expect(vi.getTimerCount()).toBe(0);
    message(popup, { event: "auth_result", result: "late-token" });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("accepts an approval message queued just before the popup closes", async () => {
    const popup = popupWindow();
    vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
    const login = await browserLogin();
    const callback = vi.fn();
    login.auth(options, callback);
    popup.close();
    vi.advanceTimersByTime(600);
    expect(callback).not.toHaveBeenCalled();
    message(popup, { event: "auth_result", result: "signed-approved-token" });
    expect(callback).toHaveBeenCalledExactlyOnceWith({
      id_token: "signed-approved-token",
    });
    vi.advanceTimersByTime(2_000);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("identifies a legacy Login Widget result without trusting its user fields", async () => {
    const popup = popupWindow();
    vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
    const login = await browserLogin();
    const callback = vi.fn();
    login.auth(options, callback);
    message(
      popup,
      JSON.stringify({
        event: "auth_result",
        result: {
          id: 123,
          username: "legacy_user",
          auth_date: 1,
          hash: "hash",
        },
      }),
    );
    expect(callback).toHaveBeenCalledExactlyOnceWith({ error: "legacy_login" });
    expect(popup.close).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels a closed popup during the grace period and ignores a late approval", async () => {
    const popup = popupWindow();
    vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
    const login = await browserLogin();
    const callback = vi.fn();
    login.auth(options, callback);
    popup.close();
    vi.advanceTimersByTime(200);
    login.close();
    message(popup, { event: "auth_result", result: "abandoned-token" });
    vi.advanceTimersByTime(2_000);
    expect(callback).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels cleanly and ignores an abandoned popup after a fresh attempt", async () => {
    const first = popupWindow();
    const second = popupWindow();
    vi.spyOn(window, "open")
      .mockReturnValueOnce(first as unknown as Window)
      .mockReturnValueOnce(second as unknown as Window);
    const login = await browserLogin();
    const abandoned = vi.fn();
    login.auth(options, abandoned);
    login.close();
    login.close();
    expect(first.close).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    const current = vi.fn();
    login.auth({ ...options, nonce: "new-server-nonce" }, current);
    message(first, { event: "auth_result", result: "old-token" });
    expect(abandoned).not.toHaveBeenCalled();
    expect(current).not.toHaveBeenCalled();
    message(second, { event: "auth_result", result: "new-token" });
    expect(current).toHaveBeenCalledExactlyOnceWith({ id_token: "new-token" });
  });

  it("surfaces a blocked popup synchronously without leaving a pending listener or timer", async () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    const login = await browserLogin();
    const callback = vi.fn();
    expect(() => login.auth(options, callback)).toThrow(/blocked/);
    expect(callback).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("Telegram native in-app handoff", () => {
  it("keeps the official SDK for a Telegram WebView with its native bridge", async () => {
    const native = { auth: vi.fn(), close: vi.fn() };
    window.TelegramWebviewProxy = { postEvent: vi.fn() };
    window.Telegram = { Login: native };
    const login = await browserLogin();
    expect(login).toBe(native);
    login.auth(options, vi.fn());
    expect(native.auth).toHaveBeenCalledOnce();
  });

  it("loads the native SDK once and allows a retry if its script fails", async () => {
    window.TelegramWebviewProxy = { postEvent: vi.fn() };
    const { telegramLoginService } = await import(
      "@/services/telegram-login.service"
    );
    const failed = telegramLoginService.load();
    const rejection = expect(failed).rejects.toThrow("Couldn't load Telegram");
    document
      .querySelector('script[src*="telegram-login.js"]')!
      .dispatchEvent(new Event("error"));
    await rejection;
    expect(vi.getTimerCount()).toBe(0);
    const ready = telegramLoginService.load();
    expect(telegramLoginService.load()).toBe(ready);
    expect(
      document.querySelectorAll('script[src*="telegram-login.js"]'),
    ).toHaveLength(1);
    const native = { auth: vi.fn(), close: vi.fn() };
    window.Telegram = { Login: native };
    document
      .querySelector('script[src*="telegram-login.js"]')!
      .dispatchEvent(new Event("load"));
    sdk = await ready;
    expect(sdk).toBe(native);
    expect(vi.getTimerCount()).toBe(0);
  });
});
