# Dashboard UI — Comprehensive Overhaul Plan

> **Branch:** `feature/dev2-dashboard`
> **Owner:** Dev 2
> **Scope:** `src/app/dashboard/*`, `src/components/dashboard/*` (+ coordinated edits to `src/store/repoStore.ts` and `package.json`)

---

## Context

The current dashboard at `src/app/dashboard/page.tsx` is functional but underbuilt for a hackathon-grade product:

- **All styling is inline** with hardcoded hex colors (`#1e293b`, `#334155`, `#f1f5f9`) repeated 20+ times across files. A full design-token system already exists in `src/app/globals.css` (`--bg-surface`, `--text-primary`, `--space-*`, `--radius-*`, `--transition-*`) but the dashboard ignores it.
- **`SessionCard` is defined inline** in `page.tsx` (lines 11–107) instead of being its own component.
- **Styles are duplicated** across `RepoCard`, `SessionCard`, the header buttons, and empty/error states — no shared `Card` / `Badge` / `Button` primitives.
- **Accessibility is weak**: clickable `<div>`s instead of buttons, no `:focus-visible` rings, icon-only buttons missing `aria-label`, no keyboard navigation.
- **Feature gaps**: no sort, no advanced filters, no pinned repos, no stats overview, no quick-jump command palette, no recent-session resume.

**Direction chosen:** Comprehensive overhaul with **Modern SaaS polish** aesthetic (Linear / Vercel / Raycast), plus all four feature adds: **⌘K command palette**, **sort & advanced filters**, **pinned/favorite repos**, and **stats strip + recent sessions row**.

**Intended outcome:** a cohesive, refined dashboard that (a) uses the existing design-token system instead of inline hex, (b) exposes a small set of reusable dashboard primitives, (c) looks clearly elevated without being gimmicky, (d) adds the four feature requests, and (e) passes basic a11y + responsive checks. Built in four independently-shippable phases so the work can land incrementally.

---

## Ownership & Constraints (per `DEV-RULES.md`)

Dev 2 owns all files under `src/app/dashboard/*` and `src/components/dashboard/*`. The following **must not be touched**:

- `src/components/ui/*` — shared, requires group-chat coordination. **Do not put new primitives here.** Instead, put dashboard-local primitives under `src/components/dashboard/ui/`.
- `src/hooks/useAuth.ts` — contract consumed by dev 3/4. Read-only.
- `src/app/api/*`, `src/lib/firebase/*`, `src/lib/github/*`, `src/middleware.ts` — other devs.
- `src/app/layout.tsx` — never edit directly; new providers go through `AppProviders.tsx` (not needed here).

Coordinate before editing:

- `package.json` — adding `cmdk` (a small, stable command-palette library) counts as "YOUR dependencies" per DEV-RULES.md rule, so fine, but announce in group chat.
- `src/store/repoStore.ts` — not explicitly owned in DEV-RULES.md. Since it's the dashboard's state, Dev 2 should own extensions; flag in group chat if touching.

---

## Phase 1 — Foundation Refactor (no visible change)

> Goal: migrate to design tokens and extract shared primitives so Phase 2 can move fast. **Zero intended visual change.**

### 1.1 Create dashboard-local UI primitives at `src/components/dashboard/ui/`

| File | Props | Purpose |
|---|---|---|
| `Card.tsx` | `hoverable?, interactive?, tone?, children` | Shared surface: background `var(--bg-surface)`, border `var(--bg-elevated)`, radius `var(--radius-lg)`, optional hover lift + gradient accent |
| `Badge.tsx` | `tone: 'neutral' \| 'success' \| 'info' \| 'warning', children` | Pill: Public/Private, Live, counts, language labels |
| `Button.tsx` | `variant: 'primary' \| 'secondary' \| 'ghost' \| 'danger', size, leftIcon?, rightIcon?` | Replace every hand-rolled `<button style={{...}}>` in the dashboard. CSS classes for `:hover`, `:focus-visible`, `:active` — no more `onMouseEnter/onMouseLeave` style mutations. |
| `IconButton.tsx` | `label (required), icon, variant` | For grid/list toggle, close buttons — enforces `aria-label`. |
| `Input.tsx` | standard input props + `leftIcon?` | Search and form fields, with `:focus-visible` ring |
| `Select.tsx` | standard select props + `label` | Language/sort filter dropdowns |
| `EmptyState.tsx` | `icon, title, description, action?` | Used by empty/error states in `RepoList.tsx` |
| `LanguageDot.tsx` | `language` | Small colored dot, language-aware (maps language → color) |

Style via a colocated `.module.css` per primitive (not inline, not shared `ui/`). Drive everything from CSS variables so Phase 2 visual tweaks become token changes.

### 1.2 Extract `SessionCard`

Move from `src/app/dashboard/page.tsx:11-107` into its own file `src/components/dashboard/SessionCard.tsx`. Use the new `Card` + `Badge` primitives. Add `role="button"`, `tabIndex={0}`, and Enter/Space keyboard handler.

### 1.3 Migrate `RepoCard.tsx` and `RepoList.tsx`

Switch to the new primitives. Replace every hardcoded hex with `var(--*)`. Keep the current visual intent; this phase must be pixel-identical (or extremely close).

### 1.4 Migrate `dashboard/page.tsx` and `dashboard/loading.tsx`

Header and toolbar switch to new primitives + tokens.

### 1.5 Migrate `CreateSession.tsx`

Use `Card`, `Button`, `Select`, and tokens. (Cannot use the shared `Modal.tsx` from `src/components/ui/` without coordination — keep the modal local but token-driven.)

**Deliverable:** identical-looking dashboard, zero inline hex colors in dashboard files, no inline event-handler style mutations, `SessionCard` in its own file.

---

## Phase 2 — Modern SaaS Visual Polish

> Goal: make it look clearly elevated, Linear/Vercel/Raycast-style. No new *features*, just a polished surface on the refactored foundation.

### 2.1 Header

File: `src/app/dashboard/page.tsx:168-254`

- Narrower height (56px), sticky with backdrop-blur
- Logo lockup: gradient square + wordmark (already present, tighten spacing + letter-spacing)
- Move global search into the header as a ⌘K trigger pill (`⌘K Search...`) in the center — becomes the command palette launcher in Phase 3
- Right side: condensed user chip (avatar + name + caret dropdown) with Sign out inside the dropdown
- Divider uses `var(--bg-elevated)` at 50% opacity

### 2.2 Hero section

Replaces the plain "Welcome back" heading:

- Larger display type (32–36px), tighter letter-spacing
- Tagline below in `var(--text-secondary)`
- **Stats strip** (Phase 3 feature, placeholder layout here): 4 metric tiles — "Repositories", "Active Sessions", "Sessions Joined", "Pinned". Flex row, `Card` primitive, token-driven.

### 2.3 Active Sessions row

If present, renders above repositories as a horizontal scrollable row (not grid) when count > 3, with a "View all" link.

### 2.4 Repositories section

- **Toolbar:** search (dashed border becomes focus-within outline), sort select, language filter, view toggle — all in a single `Card` toolbar surface
- **Section title** + count badge with animated number (optional, small CSS)
- **Grid cards** use a more refined layout:
  - Top: icon + repo name (truncate), visibility badge pushed right
  - Middle: 2-line description, muted
  - Bottom: chip row (language pill, ★ stars, updated) + Start Session primary button
  - **Hover:** subtle lift (`translateY(-2px)`), soft accent gradient on border (using `box-shadow` ring, not an extra element), 250ms `var(--transition-normal)`
  - **Focus-visible:** 2px accent ring

### 2.5 Micro-interactions

- Consolidate keyframes into a dashboard-local CSS module (not `globals.css`, which is Dev 1's): `fadeInUp`, `pulse`, `shimmer`
- Stagger card mount with `animation-delay` based on index (max 200ms cascade)
- Skeletons in `loading.tsx` use a `shimmer` gradient sweep instead of plain pulse

**Deliverable:** same features, visibly elevated dashboard. A reviewer should be able to tell it got a design pass.

---

## Phase 3 — Feature Adds

All four selected features, built on the Phase 1+2 foundation.

### 3.1 Sort & advanced filters

Extend `src/store/repoStore.ts` (coordinate in group chat first):

- New state: `sortBy: 'recent' | 'stars' | 'name'`, `visibilityFilter: 'all' | 'public' | 'private'`, `hideForks: boolean`
- New selectors: `filteredRepos` already exists — extend it to apply sort + new filters
- New UI in the toolbar: a `Select` for sort, a popover `Filter` button that opens a small panel with checkboxes (use a dashboard-local `Popover.tsx` primitive, keep it simple — click-outside-to-close, no portal)
- Filters persist to `localStorage` via a `persist` middleware wrapper around the Zustand store

### 3.2 Pinned / favorite repos

- New Zustand slice or extension on `repoStore`: `pinnedRepoIds: Set<number>`, `togglePinned(id)`
- Persisted to `localStorage` (not Firestore — avoids Dev 1's `firestore.ts` file)
- **UI:** star icon on `RepoCard` (top-right, in the header row). Filled when pinned, outline when not. Clicking toggles without bubbling to the card click.
- `RepoList` sorts pinned repos to the top with a subtle "Pinned" section label when any exist
- Stats strip shows pinned count

### 3.3 Stats strip + Recent sessions

**Stats strip** (already scaffolded in Phase 2):

- Repositories: `repos.length`
- Active Sessions: `activeSessions.length`
- Sessions Joined: count from `/api/sessions` (all sessions, not just active) — the current fetch already returns them, just needs a second filter
- Pinned: `pinnedRepoIds.size`
- Tiles use `Card` primitive with a large number and label. Subtle language-of-choice icons per tile.

**Recent sessions row:** horizontal scrollable strip below active sessions. Shows last 5 sessions (active or not) the user participated in. Each card: repo name, last-active timestamp, "Resume" button linking to `/session/{id}`. Component: `src/components/dashboard/RecentSessions.tsx`.

### 3.4 ⌘K command palette

- **Add dependency:** `cmdk` (small, stable, used by Vercel/Linear clones). Add to `package.json` (coordinate).
- **New component:** `src/components/dashboard/CommandPalette.tsx`
- **Triggers:** `⌘K` / `Ctrl+K` global listener (mounted in dashboard page), clicking the header search pill, or pressing `/`
- **Sections:**
  1. **Repositories** — fuzzy match over `repos`, enter opens the create-session modal
  2. **Sessions** — active + recent sessions, enter navigates to `/session/{id}`
  3. **Actions** — "New session", "Toggle grid/list view", "Sign out", "Go to GitHub"
- **Styling:** dark glass card centered at 15% from top, max-width 560px, token-driven
- Traps focus, closes on Escape, closes on backdrop click

**Deliverable:** four working features, no backend changes required.

---

## Phase 4 — A11y + Responsive Pass

### 4.1 Semantics & keyboard

- Audit every `<div onClick>` in the dashboard → convert to `<button>` or add `role="button"`, `tabIndex={0}`, Enter/Space handlers. Primary offenders: `SessionCard`, `RepoCard` clickable container, avatar dropdown trigger.
- `:focus-visible` outline on every interactive primitive (already baked into Phase 1 primitives — verify).
- Add `aria-label` to all icon-only buttons (grid/list toggle, close, pin, sort popover trigger).
- Add `aria-live="polite"` region for loading/error announcements in `RepoList`.
- `aria-busy` on the grid while loading.

### 4.2 Responsive

Add a small number of `@media` breakpoints via dashboard-local CSS module (not `globals.css`):

- `max-width: 640px` → single-column grid, hero font shrinks, stats strip becomes 2×2, header search pill hides (use a search icon button that opens palette)
- `max-width: 900px` → 2-column grid, sticky header loses backdrop blur to save perf

Touch targets ≥ 44×44px on mobile — increase icon-button padding. Test modal on 360×640 viewport — reduce padding, max-height + scroll.

### 4.3 Performance sanity

- `RepoList` with 100+ repos: virtualize? For hackathon: **no**, premature. Use `content-visibility: auto` on off-screen cards instead (zero-cost CSS hint).
- Debounce search input to 150ms to avoid re-filtering on every keystroke.

**Deliverable:** keyboard-navigable, mobile-usable, screen-reader-sane dashboard.

---

## Files

### Modified (Dev 2-owned)

- `src/app/dashboard/page.tsx` — refactored header/hero/sections, removes inline SessionCard, wires palette + stats
- `src/app/dashboard/loading.tsx` — new skeleton matching Phase 2 layout
- `src/components/dashboard/RepoCard.tsx` — uses new primitives, pin button
- `src/components/dashboard/RepoList.tsx` — new sort, pinned section, EmptyState primitive, content-visibility hint
- `src/components/dashboard/CreateSession.tsx` — tokens + primitives

### Created (Dev 2 scope)

- `src/components/dashboard/SessionCard.tsx`
- `src/components/dashboard/RecentSessions.tsx`
- `src/components/dashboard/StatsStrip.tsx`
- `src/components/dashboard/CommandPalette.tsx`
- `src/components/dashboard/ui/Card.tsx` + `.module.css`
- `src/components/dashboard/ui/Badge.tsx` + `.module.css`
- `src/components/dashboard/ui/Button.tsx` + `.module.css`
- `src/components/dashboard/ui/IconButton.tsx` + `.module.css`
- `src/components/dashboard/ui/Input.tsx` + `.module.css`
- `src/components/dashboard/ui/Select.tsx` + `.module.css`
- `src/components/dashboard/ui/EmptyState.tsx` + `.module.css`
- `src/components/dashboard/ui/LanguageDot.tsx`
- `src/components/dashboard/ui/Popover.tsx` + `.module.css`

### Modified (requires coordination — announce in group chat)

- `src/store/repoStore.ts` — adds `sortBy`, `visibilityFilter`, `hideForks`, `pinnedRepoIds`, `togglePinned`, `localStorage` persistence. Check ownership first; `DEV-RULES.md` doesn't name an owner for stores, so Dev 2 should claim it.
- `package.json` — adds `cmdk` dep.

### Not touched

- `src/components/ui/*` (shared, Dev 1 or coordination required)
- `src/hooks/useAuth.ts` (contract)
- `src/app/globals.css` (Dev 1 owned; everything new goes through existing tokens or dashboard-local CSS modules)
- Any `src/app/api/*`, `src/lib/firebase/*`, `src/lib/github/*`, `src/lib/yjs/*`

---

## Reuse (don't re-invent)

- **CSS variables** in `src/app/globals.css`: `--bg-base`, `--bg-surface`, `--bg-elevated`, `--text-primary`, `--text-secondary`, `--text-muted`, `--color-primary`, `--color-accent`, `--color-danger`, `--color-success`, `--space-1..16`, `--radius-sm/md/lg/full`, `--shadow-*`, `--transition-fast/normal/slow`, `--z-*`. Already defined; use them everywhere.
- **`useAuth`** at `src/hooks/useAuth.ts`: read `user`, call `logout`. Do not alter.
- **`useRepos`** at `src/hooks/useRepos.ts`: extend return with sort/filter setters (or read directly from `repoStore`).
- **`useSessionStore`** at `src/store/sessionStore.ts`: already used by page.tsx for sessions — reuse for StatsStrip and RecentSessions.
- **Toast store** at `src/store/toastStore.ts` — currently unused by dashboard. Wire up for: pin toggled, session created, filter applied (optional), command palette action executed.

---

## Verification

After each phase:

1. `npm run lint` — flat config, must pass (DEV-RULES rule 4).
2. `npm run build` — catches type errors and Next.js 16 App Router issues.
3. `npm run dev` — manual smoke test:
   - **Phase 1:** dashboard looks identical to current. No console errors. Sign out still works.
   - **Phase 2:** dashboard visibly elevated. Hover states feel smooth. Skeletons animate. Resize to 640px — still usable.
   - **Phase 3:**
     - Click a language filter + sort → repos reorder instantly, persists on reload.
     - Click the star icon on a repo → it pins to top; reload → still pinned.
     - Stats strip numbers match repo count and session count.
     - `⌘K` (or `Ctrl+K`) → palette opens, fuzzy matches, arrow keys navigate, Enter executes, Escape closes.
     - Recent sessions row renders and "Resume" navigates correctly.
   - **Phase 4:**
     - Keyboard only: Tab through the whole page, visible focus rings on every interactive element, Enter/Space activates cards, Escape closes palette/modal.
     - Chrome DevTools mobile emulation (iPhone 12): layout holds, nothing overflows, modal usable.
     - Chrome a11y audit (Lighthouse): score ≥ 95 on Accessibility.

**End-to-end session test:** sign in → land on dashboard → palette → pick repo → CreateSession modal → create session → navigate to `/session/[id]`. All paths unchanged, just prettier.

---

## Out of scope

- Light theme / theme toggle (would require touching `globals.css` → Dev 1 territory)
- Backend changes (Dev 4)
- Editor UI, chat UI, auth UI
- Virtualized repo list (premature)
- Internationalization
- Analytics / telemetry
- Unit tests (no test runner configured in the repo per `CLAUDE.md`)
