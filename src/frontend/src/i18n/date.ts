import { getLanguage, getLocale } from "./index";

const months = [
  ["იან.", "იანვარი"],
  ["თებ.", "თებერვალი"],
  ["მარ.", "მარტი"],
  ["აპრ.", "აპრილი"],
  ["მაი.", "მაისი"],
  ["ივნ.", "ივნისი"],
  ["ივლ.", "ივლისი"],
  ["აგვ.", "აგვისტო"],
  ["სექ.", "სექტემბერი"],
  ["ოქტ.", "ოქტომბერი"],
  ["ნოე.", "ნოემბერი"],
  ["დეკ.", "დეკემბერი"],
] as const;
const weekdays: Record<string, readonly [string, string]> = {
  Monday: ["ორშ.", "ორშაბათი"],
  Tuesday: ["სამ.", "სამშაბათი"],
  Wednesday: ["ოთხ.", "ოთხშაბათი"],
  Thursday: ["ხუთ.", "ხუთშაბათი"],
  Friday: ["პარ.", "პარასკევი"],
  Saturday: ["შაბ.", "შაბათი"],
  Sunday: ["კვი.", "კვირა"],
};

export function formatClubDate(
  date: Date,
  options: Intl.DateTimeFormatOptions,
) {
  const settings = { ...options, timeZone: options.timeZone ?? "Asia/Tbilisi" };
  if (getLanguage() !== "ka")
    return new Intl.DateTimeFormat(getLocale(), settings).format(date);

  // Some WebKit builds omit Georgian ICU data. Always provide Georgian names
  // while using Intl for the venue's calendar day and numeric date components.
  const month =
    Number(
      new Intl.DateTimeFormat("en-GB", {
        month: "numeric",
        timeZone: settings.timeZone,
      }).format(date),
    ) - 1;
  const weekday = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    timeZone: settings.timeZone,
  }).format(date);
  return new Intl.DateTimeFormat("en-GB", settings)
    .formatToParts(date)
    .map((part) => {
      if (
        part.type === "month" &&
        options.month !== "numeric" &&
        options.month !== "2-digit"
      )
        return months[month][options.month === "short" ? 0 : 1];
      if (part.type === "weekday")
        return weekdays[weekday][options.weekday === "short" ? 0 : 1];
      return part.value;
    })
    .join("");
}
