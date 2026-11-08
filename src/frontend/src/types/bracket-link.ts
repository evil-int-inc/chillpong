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

/** Links without a layout retain the original Extended fullscreen view. */
export function bracketPath(
  tournamentId: bigint | string,
  layout: BracketLayout = "extended",
) {
  const suffix = layout === "compact" ? "&layout=compact" : "";
  return `/tournaments/${encodeURIComponent(tournamentId.toString())}?view=bracket${suffix}`;
}

export function bracketUrl(
  tournamentId: bigint | string,
  origin = window.location.origin,
  layout: BracketLayout = "extended",
) {
  return new URL(bracketPath(tournamentId, layout), origin).toString();
}
