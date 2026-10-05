import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { BracketGraph } from "@/components/tournaments/BracketGraph";
import {
  LANGUAGE_STORAGE_KEY,
  getLanguage,
  getLocale,
  setLanguage,
  translate,
  translateError,
  translateHistory,
} from "@/i18n";
import { formatClubDate } from "@/i18n/date";
import { ka } from "@/i18n/ka";
import { messages } from "@/i18n/messages";
import { countLabel } from "@/i18n/plurals";
import { ru } from "@/i18n/ru";
import { ProfilePage } from "@/pages/ProfilePage";
import { roundLabel } from "@/types/player-filters";
import {
  type TournamentMatchView,
  type TournamentPlayerView,
  sourceLabel,
  tbilisiTime,
} from "@/types/tournament-manager";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  profile: { displayName: "Nino", username: "nino" },
  actor: { getCallerProfile: vi.fn(), saveCallerProfile: vi.fn() },
}));
vi.mock("@caffeineai/core-infrastructure", () => ({
  useActor: () => ({ actor: state.actor, isFetching: false }),
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    principal: "rrkah-fqaaa-aaaaa-aaaaq-cai",
  }),
}));

beforeEach(() => {
  setLanguage("en");
  localStorage.clear();
  state.actor.getCallerProfile.mockResolvedValue(state.profile);
  state.actor.saveCallerProfile.mockRejectedValue(
    new Error("Username already taken"),
  );
});
afterEach(() => {
  act(() => setLanguage("en"));
  localStorage.clear();
  vi.restoreAllMocks();
});

function renderProfile() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <LanguageSwitcher />
      <ProfilePage />
    </QueryClientProvider>,
  );
}

describe("language selection", () => {
  it("defaults to English and changes the entire profile without losing draft fields", async () => {
    const user = userEvent.setup();
    renderProfile();
    const name = await screen.findByRole("textbox", {
      name: "Name / optional",
    });
    await user.clear(name);
    await user.type(name, "ნინო / Nina");
    await user.click(screen.getByRole("button", { name: "Change language" }));
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    await user.click(screen.getByRole("radio", { name: "Русский" }));
    expect(
      screen.getByRole("button", { name: "Сохранить профиль" }),
    ).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: "Имя / необязательно" }),
    ).toHaveValue("ნინო / Nina");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("ru");
    expect(document.documentElement.lang).toBe("ru");
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Изменить язык" }));
    await user.click(screen.getByRole("radio", { name: "ქართული" }));
    expect(
      screen.getByRole("button", { name: "პროფილის შენახვა" }),
    ).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: "სახელი / არასავალდებულო" }),
    ).toHaveValue("ნინო / Nina");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("ka");
    expect(document.documentElement.lang).toBe("ka");
    expect(screen.getByText("rrkah-fqaaa-aaaaa-aaaaq-cai")).toBeVisible();
  });

  it("updates visible validation messages when switching languages", async () => {
    const user = userEvent.setup();
    renderProfile();
    const username = await screen.findByRole("textbox", {
      name: "Username / optional",
    });
    await user.clear(username);
    await user.type(username, "x");
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Username needs 3–30");
    act(() => setLanguage("ru"));
    expect(screen.getByRole("alert")).toHaveTextContent("Никнейм: 3–30");
    act(() => setLanguage("ka"));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "მომხმარებლის სახელი: 3–30",
    );
  });

  it("localizes a backend error and continues updating it after the save fails", async () => {
    const user = userEvent.setup();
    renderProfile();
    await screen.findByRole("button", { name: "Save profile" });
    act(() => setLanguage("ru"));
    await user.click(screen.getByRole("button", { name: "Сохранить профиль" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Этот никнейм уже занят",
    );
    act(() => setLanguage("ka"));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "მომხმარებლის ეს სახელი დაკავებულია",
    );
  });

  it("supports keyboard dismissal and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher />);
    const trigger = screen.getByRole("button", { name: "Change language" });
    await user.click(trigger);
    await user.tab();
    expect(screen.getByRole("radio", { name: "English" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("stays usable if local storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage disabled");
    });
    const user = userEvent.setup();
    render(<LanguageSwitcher />);
    await user.click(screen.getByRole("button", { name: "Change language" }));
    await user.click(screen.getByRole("radio", { name: "ქართული" }));
    expect(getLanguage()).toBe("ka");
    expect(
      screen.getByRole("button", { name: "ენის შეცვლა" }),
    ).toHaveTextContent("KA");
  });

  it("syncs an existing page when another tab changes or clears the preference", () => {
    render(<LanguageSwitcher />);
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: LANGUAGE_STORAGE_KEY,
          newValue: "ru",
        }),
      );
    });
    expect(
      screen.getByRole("button", { name: "Изменить язык" }),
    ).toHaveTextContent("RU");
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: LANGUAGE_STORAGE_KEY,
          newValue: null,
        }),
      );
    });
    expect(
      screen.getByRole("button", { name: "Change language" }),
    ).toHaveTextContent("EN");
  });
});

describe("translation coverage", () => {
  it("refreshes bracket headings and playing matches when the language changes", () => {
    const match: TournamentMatchView = {
      id: 1n,
      bracket: "winners",
      round: 1,
      position: 1,
      playerAId: 1n,
      playerBId: 2n,
      sourceA: { kind: "player", id: 1n },
      sourceB: { kind: "player", id: 2n },
      status: "playing",
      table: 1,
      manualOverride: false,
      prioritized: false,
    };
    const players: TournamentPlayerView[] = ["Players", "ნინო"].map(
      (name, index) => ({
        id: BigInt(index + 1),
        name,
        skill: 2,
        registrationNumber: BigInt(index + 1),
        registeredAt: 0n,
        status: "playing",
        losses: 0,
        manualOverride: false,
      }),
    );
    render(
      <BracketGraph matches={[match]} players={players} onSelect={() => {}} />,
    );
    expect(screen.getByText("Round 1")).toBeVisible();
    act(() => setLanguage("ru"));
    expect(screen.getByText("Раунд 1")).toBeVisible();
    expect(screen.getByTestId("match.card.1")).toHaveTextContent("играет");
    act(() => setLanguage("ka"));
    expect(screen.getByText("რაუნდი 1")).toBeVisible();
    const card = screen.getByTestId("match.card.1");
    expect(card).toHaveTextContent("თამაშობს");
    expect(within(card).getByText("Players")).toBeVisible();
    expect(within(card).getByText("ნინო")).toBeVisible();
  });
  it("has complete catalogs with the same interpolation variables", () => {
    const placeholders = (value: string) =>
      [...value.matchAll(/\{\w+\}/g)].map((match) => match[0]).sort();
    for (const catalog of [ru, ka]) {
      expect(Object.keys(catalog).sort()).toEqual([...messages].sort());
      for (const message of messages) {
        expect(catalog[message].trim()).not.toBe("");
        expect(placeholders(catalog[message])).toEqual(placeholders(message));
      }
    }
  });

  it("interpolates notices and history without translating user content", () => {
    setLanguage("ka");
    expect(
      translate({
        message: "{name} is now an admin.",
        params: { name: "Players / ნინო" },
      }),
    ).toBe("Players / ნინო ახლა ადმინისტრატორია.");
    expect(translateHistory("Register Players / ნინო")).toBe(
      "რეგისტრაცია: Players / ნინო",
    );
    expect(
      translateError(
        "Canister trapped: Username already taken\nTransport details",
      ),
    ).toBe("მომხმარებლის ეს სახელი დაკავებულია");
    expect(translateError("Network timeout")).toBe(
      "შეცდომა მოხდა. სცადეთ ხელახლა.",
    );
    setLanguage("en");
    expect(translateError("Network timeout")).toBe("Network timeout");
  });

  it("localizes bracket dependencies, rounds, dates and Russian number forms", () => {
    setLanguage("ru");
    expect(sourceLabel({ kind: "winner", id: 1n }, [])).toBe("Победитель / M1");
    expect(
      roundLabel({ bracket: "winners", round: 3 } as Parameters<
        typeof roundLabel
      >[0]),
    ).toBe("Сетка победителей / Раунд 3");
    expect(
      [1, 2, 5, 21, 22, 25].map((count) => countLabel(count, "player")),
    ).toEqual([
      "1 игрок",
      "2 игрока",
      "5 игроков",
      "21 игрок",
      "22 игрока",
      "25 игроков",
    ]);
    expect(getLocale()).toBe("ru-RU");
    setLanguage("ka");
    expect(
      roundLabel({ bracket: "losers", round: 0 } as Parameters<
        typeof roundLabel
      >[0]),
    ).toBe("დამარცხებულთა ბადე / შესარჩევი");
    expect(countLabel(2, "table")).toBe("2 მაგიდა");
    expect(getLocale()).toBe("ka-GE");
    expect(
      formatClubDate(new Date("2026-10-09T17:00:00Z"), {
        weekday: "short",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    ).toBe("პარ., 9 ოქტომბერი 2026");
    expect(
      formatClubDate(new Date("2026-10-09T22:00:00Z"), {
        weekday: "long",
        day: "numeric",
        month: "short",
      }),
    ).toBe("შაბათი 10 ოქტ.");
    expect(
      tbilisiTime(BigInt(Date.parse("2026-10-09T17:00:00Z")) * 1_000_000n),
    ).toBe("21:00");
  });
});
