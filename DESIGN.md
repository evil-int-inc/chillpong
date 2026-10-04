# ChillPong Design Brief

## Direction

An underground ping-pong tournament in a Tbilisi bar at night. The club feels urban, industrial, energetic, and slightly rebellious. Players and tournaments are the main public sections; Admin handles account details and role management. Only admins create or edit players, member records and tournaments.

## Brand

Keep the supplied hedgehog/paddle roundel as the favicon, header logo, and sidebar brand mark. Pair it with large geometric CHILL PONG typography and short club language. Technical court lines, registration numbers, local start times, and subtle grain give the interface a warehouse atmosphere.

## Theme and Palette

Use the daisyUI `black` theme with the overrides in `src/frontend/src/index.css`. Keep the application dark at every viewport size.

| Token | Color | Use |
| --- | --- | --- |
| base-100 | `#101010` | Main canvas |
| base-200 | `#171717` | Secondary surfaces |
| base-300 | `#303030` | Thin dividers and control borders |
| base-content | `#f3f2ed` | Primary typography |
| primary / accent | `#d7f347` | Actions, active navigation, display emphasis |
| secondary | `#ff513d` | Live states and small industrial markers |
| muted-foreground | `#999993` | Supporting text |

Keep accents concentrated. White typography and charcoal surfaces carry most of the page. Avoid blue SaaS controls, corporate gradients, and decorative glows.

## Typography

- Space Grotesk: large tightly spaced headlines, brand, and section titles.
- DM Sans: readable descriptions, forms, and member information.
- Geist Mono: uppercase labels, event IDs, dates, and small technical details.

Use oversized display type where it establishes the club identity, balanced with compact metadata and generous spacing.

## Structure and Components

- Desktop: fixed club sidebar, slim header, spacious content area, minimal footer.
- Mobile: branded header and accessible navigation drawer; stack hero and event content.
- Tournament board: bordered rows with prominent dates, venue/time metadata, and clear live/upcoming/completed states.
- Players: tournament-scoped lineup with permanent registration numbers and times, skill, live status, table and current match. Name search and skill/status/table/current-round filters combine; sorting offers registration order, name, skill and status. Registration order is the default and remains available after every sort. Distinguish winners and losers rounds and derive current rounds from pending matches rather than completed history.
- Admin accounts: simple geometric panels with names, handles, avatars, and admin markers; keep account editing under Admin.
- Buttons, inputs, filters, and dialogs: square edges, thin borders, high contrast, and restrained hover changes.
- Depth: surface tones and hairline dividers; keep shadows minimal.

## Tournament Room

Each event opens a public tournament room with two views:

- **Standard:** ongoing matches at physical tables, the next five decided and playable matches, and the waiting queue.
- **Extended:** the full knockout map with round labels and dependency connectors. Double elimination includes winners, losers, grand final, and the conditional reset final.

Keep view switching prominent. Large brackets scroll inside their own viewport and offer zoom controls; they must not widen the entire page. Match cards show names, skill levels, original registration numbers, round, table, status, and scores.

Admins manage registrations, elimination format, table count, match results, and manual overrides from the same room. Clearly mark overrides. Explain the consequences of withdrawals and resets before confirming them. Show that changes save automatically, and expose undo for recent actions.

Tournament players are event registrations, separate from application accounts. Their registration numbers and timestamps remain permanent, including after skill edits and queue changes. Expected player count is a planning estimate, not a registration limit.

## Accessibility and Motion

Preserve visible focus outlines, descriptive action labels, keyboard-accessible dialogs, readable contrast, and meaningful empty/error/loading states. Honor reduced-motion preferences. Decorative grain and court geometry must remain subtle and must not obstruct text or interactions.

## Avoid

Excessive rounded cards, pill-shaped controls, enterprise dashboard polish, childish gaming graphics, and video-platform language. The product should feel like a real local club: good people, bad backhands, late nights.
