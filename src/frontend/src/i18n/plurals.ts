import { getLanguage } from "./index";

const nouns = {
  player: ["player", "players", "игрок", "игрока", "игроков", "მოთამაშე"],
  table: ["table", "tables", "стол", "стола", "столов", "მაგიდა"],
  physicalTable: [
    "physical table",
    "physical tables",
    "стол",
    "стола",
    "столов",
    "მაგიდა",
  ],
  admin: ["admin", "admins", "админ", "админа", "админов", "ადმინი"],
  account: [
    "account",
    "accounts",
    "аккаунт",
    "аккаунта",
    "аккаунтов",
    "ანგარიში",
  ],
  loss: ["loss", "losses", "поражение", "поражения", "поражений", "წაგება"],
  person: ["person", "people", "участник", "участника", "участников", "წევრი"],
  slot: [
    "opening slot",
    "opening slots",
    "стартовое место",
    "стартовых места",
    "стартовых мест",
    "საწყისი პოზიცია",
  ],
  expectedPlayer: [
    "expected player",
    "expected players",
    "ожидаемый игрок",
    "ожидаемых игрока",
    "ожидаемых игроков",
    "მოსალოდნელი მოთამაშე",
  ],
} as const;

export function countLabel(count: number | bigint, noun: keyof typeof nouns) {
  const language = getLanguage();
  const forms = nouns[noun];
  const rule = new Intl.PluralRules(language).select(Number(count));
  const word =
    language === "ka"
      ? forms[5]
      : language === "ru"
        ? forms[rule === "one" ? 2 : rule === "few" ? 3 : 4]
        : forms[rule === "one" ? 0 : 1];
  return `${count} ${word}`;
}
