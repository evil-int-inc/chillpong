# ChillPong Design Brief

## Direction

An underground ping-pong tournament in a Tbilisi bar at night. The club feels urban, industrial, energetic, and slightly rebellious. Users and tournaments are the main public sections; Admin handles role management. Only admins create or edit member records and tournaments.

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
- Members: simple geometric panels with names, handles, avatars, and admin markers.
- Buttons, inputs, filters, and dialogs: square edges, thin borders, high contrast, and restrained hover changes.
- Depth: surface tones and hairline dividers; keep shadows minimal.

## Accessibility and Motion

Preserve visible focus outlines, descriptive action labels, keyboard-accessible dialogs, readable contrast, and meaningful empty/error/loading states. Honor reduced-motion preferences. Decorative grain and court geometry must remain subtle and must not obstruct text or interactions.

## Avoid

Excessive rounded cards, pill-shaped controls, enterprise dashboard polish, childish gaming graphics, and video-platform language. The product should feel like a real local club: good people, bad backhands, late nights.
