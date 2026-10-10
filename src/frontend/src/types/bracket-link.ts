/** A shareable bracket link always opens the tournament in its full-page view. */
export function bracketPath(tournamentId: bigint | string) {
  return `/tournaments/${encodeURIComponent(tournamentId.toString())}?view=bracket`;
}

export function bracketUrl(
  tournamentId: bigint | string,
  origin = window.location.origin,
) {
  return new URL(bracketPath(tournamentId), origin).toString();
}
