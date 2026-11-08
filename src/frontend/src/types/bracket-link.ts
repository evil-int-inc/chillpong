export type BracketLayout = "compact" | "extended";

export function validateBracketSearch(search: Record<string, unknown>): {
  view?: "bracket";
  layout?: "compact";
} {
  if (search.view !== "bracket") return {};
  return search.layout === "compact"
    ? { view: "bracket", layout: "compact" }
    : { view: "bracket" };
}

/** New share links default to Standard. The bare bracket URL opens Extended. */
export function bracketPath(
  tournamentId: bigint | string,
  layout: BracketLayout = "compact",
) {
  const suffix = layout === "compact" ? "&layout=compact" : "";
  return `/tournaments/${encodeURIComponent(tournamentId.toString())}?view=bracket${suffix}`;
}

export function bracketUrl(
  tournamentId: bigint | string,
  origin = window.location.origin,
  layout?: BracketLayout,
) {
  return new URL(bracketPath(tournamentId, layout), origin).toString();
}
