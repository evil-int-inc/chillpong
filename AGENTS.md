# Project Guidance

## User Preferences

- App name is ChillPong
- Use the provided hedgehog/paddle roundel logo as the app icon and header/sidebar brand mark
- User roles are limited to null or admin
- Only admins may assign admin roles
- The owner account must receive admin role on every setup, including in production

## Verified Commands

- **typecheck**: `mops check --fix`
- **build**: `mops build`

## Learnings

- ChillPong branding is wired: favicon.ico linked via <link rel=icon> and logo.jpg rendered in Header/Sidebar; both copied into dist/ by the Vite build.
- No image tooling (ImageMagick/PIL/sharp) is preinstalled; temporarily add sharp as a dev dependency to build a multi-size ICO, then remove it.
- index.html social meta tags (og:*, twitter:*) must be preserved; keep og:title identical to <title>.
- Backend verification sequence: `mops install && mops check --fix` then `mops build`, then `pnpm bindgen` from project root.
- Frontend verification sequence: `pnpm typecheck && pnpm fix && pnpm build`.
- Route guards must trigger login() from a useEffect keyed on isInitializing/isAuthenticated, never in the render body, to avoid setState-during-render and infinite loops.
- Owner bootstrap with no init args: capture the first bootstrapOwner() caller as ownerPrincipal, mirror the authorization package's #admin onto the app-level User.role, and re-apply idempotently on every sign-in so the owner keeps admin across upgrades.
- getMyRole must not call AccessControl.isAdmin for unregistered callers (it traps); base it on the User.role field plus an ownerApplied fallback so anonymous/unregistered callers get null instead of a trap.
- The visual-QA mock shim overrides useActor but not useInternetIdentity, so auth-gated routes (/admin, /profile, /upload) cannot be visually verified in the preview harness.
