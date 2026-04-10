# Dashboard UI — Comprehensive Overhaul Plan (shadcn/ui edition)

> **Branch:** `feature/dev2-dashboard`
> **Owner:** Dev 2
> **Substrate:** shadcn/ui + Tailwind v4 + Radix primitives
> **Scope:** `src/app/dashboard/*`, `src/components/dashboard/*` (+ coordinated edits to `src/components/ui/*`, `src/app/globals.css`, `src/store/repoStore.ts`, and `package.json`)

---

## Context

The current dashboard at `src/app/dashboard/page.tsx` is functional but underbuilt:

- **All styling is inline** with hardcoded hex colors (`#1e293b`, `#334155`, `#f1f5f9`) repeated 20+ times. A rich design-token system already exists in `src/app/globals.css` (`--bg-surface`, `--text-primary`, `--space-*`, `--radius-*`) but the dashboard ignores it.
- **`SessionCard` is defined inline** in `page.tsx` (lines 11–107) instead of being its own component.
- **No shared primitives** — card styles, button styles, empty/error states are duplicated across `RepoCard`, `SessionCard`, the header.
- **Accessibility is weak** — clickable `<div>`s instead of buttons, no `:focus-visible` rings, icon-only buttons missing `aria-label`, no keyboard navigation.
- **Feature gaps** — no sort, no advanced filters, no pinned repos, no stats overview, no command palette, no recent-session resume.

**Direction chosen:** comprehensive overhaul with **Modern SaaS polish** (Linear / Vercel / Raycast aesthetic), plus all four feature adds: **⌘K command palette**, **sort & advanced filters**, **pinned/favorite repos**, and **stats strip + recent sessions row**. **UI substrate: shadcn/ui** — not hand-rolled primitives.

**Why shadcn changes the plan shape:**

1. **Phase 1 is "install + theme shadcn" instead of "build primitives".** Less new code, more config.
2. **Accessibility is mostly free** — shadcn is built on Radix UI, which gives focus management, keyboard nav, ARIA, and screen reader support out of the box. Phase 4 shrinks to "responsive + semantic audit".
3. **⌘K palette is trivial** — shadcn ships `Command` (built on `cmdk` + Radix). Phase 3.4 drops from "build a custom palette" to "install `command` component + wire data".

**Intended outcome:** a cohesive, refined dashboard that uses shadcn primitives mapped to the existing design tokens, looks clearly elevated, adds the four feature requests, and passes basic a11y + responsive checks. Four independently-shippable phases (plus a Phase 0 setup) so the work can land incrementally.

---

## Current state (verified)

- **Tailwind v4** is installed (`tailwindcss: ^4`, `@tailwindcss/postcss: ^4`). Shadcn supports Tailwind v4 via `npx shadcn@latest init`.
- **`src/app/globals.css`** uses the v4 `@import "tailwindcss"` + `@theme inline` pattern and already defines a rich custom token system: `--color-primary`, `--bg-base/surface/elevated`, `--text-primary/secondary/muted`, `--space-1..16`, `--radius-sm/md/lg`, `--shadow-*`, `--transition-*`, `--z-*`. Two Tailwind-compat aliases already exist: `--background → --bg-base`, `--foreground → --text-primary`.
- **Shadcn is not yet initialized** — no `components.json`, no `src/lib/utils.ts`, no shadcn-flavored components in `src/components/ui/`.
- **`src/components/ui/`** currently contains: `Button.tsx`, `Modal.tsx`, `Loader.tsx`, `Toast.tsx`, `ErrorBoundary.tsx` (all hand-rolled, no CVA / Radix), plus `Avatar.tsx` and `Badge.tsx` stubs (TODO-only).
- **No shadcn-related deps in `package.json`** — no `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `@radix-ui/*`, `cmdk`, `tailwindcss-animate`.
- **Dashboard files** — `SessionCard` still inline in `page.tsx:11-107`. `RepoCard.tsx`, `RepoList.tsx`, `CreateSession.tsx` all present, inline-styled.

---

## Ownership & Coordination

`DEV-RULES.md` has been deleted, but implicit ownership still matters for merge hygiene. For this plan:

- **`src/components/ui/*`** — shadcn's default install target is this directory, so we cannot avoid it. We will **replace** stubs (`Avatar.tsx`, `Badge.tsx`) with shadcn versions, **replace** hand-rolled `Button.tsx` and `Modal.tsx` with shadcn `button` and `dialog`, and **keep** `Loader.tsx`, `Toast.tsx`, `ErrorBoundary.tsx`.
- **`src/app/globals.css`** — Dev 1's file. Shadcn init appends CSS variables here; we will manually reconcile them to alias existing custom tokens (see Phase 0.3). **Announce in group chat before running `shadcn init`.**
- **`package.json`** — shadcn init and component installs add many deps. Announce before running.
- **`src/app/layout.tsx`** — do not edit. No provider needed for shadcn itself.
- **`src/hooks/useAuth.ts`** — contract. Do not change.
- **`src/app/api/*`, `src/lib/firebase/*`, `src/lib/github/*`, `src/lib/yjs/*`, `src/proxy.ts`** — not touched.

---

## Phase 0 — Shadcn Setup (prerequisite, no visible change)

> Goal: get shadcn initialized and mapped to the existing design tokens so Phase 1 can install components cleanly.

### 0.1 Install shadcn base dependencies

```bash
npm install class-variance-authority clsx tailwind-merge lucide-react tailwindcss-animate
```

- `class-variance-authority` — variant/size props for shadcn components
- `clsx` + `tailwind-merge` — power the `cn()` helper
- `lucide-react` — icon set (replaces hand-rolled inline SVGs)
- `tailwindcss-animate` — shadcn's animation utility plugin (needed even on Tailwind v4)

### 0.2 Run `npx shadcn@latest init`

This creates:

- `components.json` at repo root
- `src/lib/utils.ts` — exports the `cn()` helper
- Appends a block of CSS variables to `src/app/globals.css`

When prompted, choose:

- **Style:** `default`
- **Base color:** `slate` (matches existing palette closest)
- **CSS variables:** `yes`
- **Tailwind prefix:** none
- **Import aliases:** `@/components`, `@/lib`, `@/hooks`
- **React Server Components:** `yes`

### 0.3 Reconcile shadcn tokens with existing custom tokens

After init, **edit `src/app/globals.css`** so shadcn tokens alias the existing custom tokens rather than introducing a parallel color system. Concretely, inside `:root`:

```css
:root {
  /* Keep existing custom tokens as source of truth */
  --bg-base: #0f172a;
  --bg-surface: #1e293b;
  /* ...etc (unchanged)... */

  /* Shadcn tokens → map to existing */
  --background: var(--bg-base);
  --foreground: var(--text-primary);
  --card: var(--bg-surface);
  --card-foreground: var(--text-primary);
  --popover: var(--bg-elevated);
  --popover-foreground: var(--text-primary);
  --primary: var(--color-primary);
  --primary-foreground: #ffffff;
  --secondary: var(--bg-elevated);
  --secondary-foreground: var(--text-primary);
  --muted: var(--bg-surface);
  --muted-foreground: var(--text-muted);
  --accent: var(--color-accent);
  --accent-foreground: #ffffff;
  --destructive: var(--color-danger);
  --destructive-foreground: #ffffff;
  --border: var(--border-default);
  --input: var(--border-default);
  --ring: var(--color-primary);
  --radius: var(--radius-md);
}
```

Do not create a `.dark` selector — the app is dark-only. Leave `.dark` empty or remove it.

### 0.4 Verify

- `npm run lint` → 0 errors
- `npm run build` → succeeds
- `npm run dev` → dashboard renders identically (no shadcn components in use yet)

**Deliverable:** shadcn initialized, mapped to existing tokens, zero visible change.

---

## Phase 1 — Install shadcn components + migrate dashboard

> Goal: replace every hand-rolled primitive in the dashboard with a shadcn component. **Zero intended visual change.**

### 1.1 Install shadcn components

```bash
npx shadcn@latest add button card badge input select dialog command popover dropdown-menu avatar skeleton separator tooltip
```

This adds ~13 files under `src/components/ui/<component>.tsx` and pulls in `@radix-ui/react-*` packages + `cmdk` for `command`.

### 1.2 Replace pre-existing hand-rolled files

- **Delete** `src/components/ui/Button.tsx` — shadcn's lowercase `button.tsx` replaces it. Grep the repo for `from '@/components/ui/Button'` and update imports to `from '@/components/ui/button'`.
- **Delete** `src/components/ui/Modal.tsx` — callers use shadcn's `Dialog` (`dialog.tsx`). Grep and update imports.
- **Delete** `src/components/ui/Avatar.tsx` and `src/components/ui/Badge.tsx` (TODO stubs) — shadcn replacements exist.
- **Keep** `Loader.tsx`, `Toast.tsx`, `ErrorBoundary.tsx`.

### 1.3 Extract `SessionCard` from page.tsx

Move `src/app/dashboard/page.tsx:11-107` into `src/components/dashboard/SessionCard.tsx`. Built with shadcn `Card` + `Badge` + `Avatar`. Use a `<button>` element (or `Card` with `role="button" tabIndex={0}`) for keyboard support.

### 1.4 Migrate `RepoCard.tsx`

Replace inline-styled card with `Card` + `CardHeader` + `CardContent` + `CardFooter`. Replace inline button with shadcn `Button` (variant `default` for Start Session, variant `ghost` for the future pin action). Language dot stays custom (no shadcn equivalent).

### 1.5 Migrate `RepoList.tsx`

- Loading state: shadcn `Skeleton`
- Empty/error states: local small component that wraps shadcn `Card` + `Button` (no shadcn `EmptyState` exists)

### 1.6 Migrate `dashboard/page.tsx` + `loading.tsx`

- **Header** — logo lockup stays custom (brand mark). User section uses shadcn `DropdownMenu` (trigger is `Avatar`, items: user name header, Separator, "Sign out").
- **Toolbar** — search via shadcn `Input`, language filter via shadcn `Select`, grid/list toggle via two shadcn `Button size="icon" variant="ghost"` with `aria-label`.
- **`loading.tsx`** — skeleton divs → shadcn `Skeleton`.

### 1.7 Migrate `CreateSession.tsx`

Full rewrite using shadcn `Dialog` + `DialogHeader` + `DialogFooter`, `Select` for branch, `Button` for actions. Delete all hand-rolled modal backdrop and animation code.

**Deliverable:** functionally identical dashboard, fully on shadcn, no inline hex colors in dashboard files, `SessionCard` extracted.

---

## Phase 2 — Modern SaaS Visual Polish

> Apply Linear/Vercel/Raycast aesthetic on top of the shadcn substrate. No new features, just a refined look.

### 2.1 Header

- Narrower height (56px), sticky with `backdrop-blur`
- Tightened logo lockup (letter-spacing, gap)
- Center: ⌘K trigger styled as `Button variant="outline"` with a `<kbd>⌘K</kbd>` chip on the right. Opens the command palette (Phase 3.4).
- Right: `Avatar` inside `DropdownMenu` with items — user name header, Separator, "Sign out"

### 2.2 Hero section

- Display type: 32–36px, tight letter-spacing, weight 800
- Subhead in `text-muted-foreground`
- **Stats strip placeholder** (4 `Card` tiles in `grid grid-cols-4 gap-4`) — populated in Phase 3.3

### 2.3 Active Sessions row

When sessions exist, render as a horizontal scrollable row of `SessionCard`s (not a grid) with a "View all" link. Overflow-x via `overflow-x-auto snap-x`.

### 2.4 Repositories section

- Toolbar sits inside a shadcn `Card` surface
- Section title + animated count `Badge`
- Grid cards use refined layout:
  - Top row: icon + name (truncate) + visibility `Badge` pushed right
  - Description: 2 lines, `text-muted-foreground`
  - Bottom row: chip row (language dot + name, ★ stars, updated) + primary `Button` "Start Session"
  - Hover: `hover:-translate-y-0.5 hover:ring-2 hover:ring-primary/30 transition`
  - Focus-visible: shadcn handles via `ring-ring`

### 2.5 Micro-interactions

- Stagger card mount with `animation-delay` based on index
- Skeletons use shadcn's built-in shimmer
- `tailwindcss-animate` provides `animate-in fade-in slide-in-from-bottom-2` for page entrance

**Deliverable:** same features, visibly elevated dashboard.

---

## Phase 3 — Feature Adds

### 3.1 Sort & advanced filters

Extend `src/store/repoStore.ts`:

- New state: `sortBy: 'recent' | 'stars' | 'name'`, `visibilityFilter: 'all' | 'public' | 'private'`, `hideForks: boolean`
- Extend `filteredRepos` selector to apply sort + new filters
- Persist to `localStorage` via Zustand's `persist` middleware

**UI:**

- Sort: shadcn `Select` in the toolbar
- Advanced filters: shadcn `Popover` triggered by a `Button variant="outline"` with filter icon. Popover content: `Checkbox` items for visibility and forks (install with `npx shadcn@latest add checkbox`).

### 3.2 Pinned / favorite repos

- Extend `repoStore.ts`: `pinnedRepoIds: Set<number>`, `togglePinned(id)`
- Persist to `localStorage` (not Firestore)
- `RepoCard` gets a pin button top-right — `Button size="icon" variant="ghost"` with lucide `Star` icon (filled when pinned). `stopPropagation` on click so it doesn't bubble to the card.
- `RepoList` sorts pinned repos to the top with a "Pinned" section label when `pinnedRepoIds.size > 0`
- Stats strip shows pinned count

### 3.3 Stats strip + Recent sessions

**Stats strip** — four `Card` tiles:

- Repositories: `repos.length`
- Active Sessions: `activeSessions.length`
- Sessions Joined: total count from `/api/sessions`
- Pinned: `pinnedRepoIds.size`

Each tile: big number, label, subtle lucide icon.

**Recent sessions** — new component `src/components/dashboard/RecentSessions.tsx`:

- Horizontal scrollable row of last 5 sessions the user participated in
- Each card: repo name, last-active timestamp, `Button variant="secondary"` "Resume" linking to `/session/{id}`

### 3.4 ⌘K command palette

Thanks to shadcn `Command` (installed in Phase 1.1), this is mostly data wiring:

- New component: `src/components/dashboard/CommandPalette.tsx`
- Uses `CommandDialog` (shadcn primitive built on Radix Dialog + cmdk) — handles focus trap, Esc, backdrop close for free
- Global keyboard listener for `⌘K` / `Ctrl+K` mounted in dashboard page
- Groups (shadcn `CommandGroup`):
  1. **Repositories** — fuzzy match over `repos`, Enter opens CreateSession dialog with that repo preselected
  2. **Sessions** — active + recent sessions, Enter navigates to `/session/{id}`
  3. **Actions** — "New session", "Toggle view mode", "Sign out", "Open GitHub profile"
- Each item uses `CommandItem` with lucide icon + label + optional shortcut chip

**Deliverable:** four working features, no backend changes required.

---

## Phase 4 — A11y + Responsive Pass

Much smaller than before because Radix/shadcn handles most a11y automatically.

### 4.1 Semantics verification

- Radix components already provide focus management, keyboard nav, ARIA roles, `aria-label` enforcement for icon buttons, focus trapping in Dialog/Popover/DropdownMenu.
- **Audit** the dashboard for residual `<div onClick>` patterns (`RepoCard` wrapper, for example) and convert to `<button>` or add `role="button" tabIndex={0}` + Enter/Space handlers.
- Run Lighthouse accessibility audit; target ≥ 95.

### 4.2 Responsive

- Tailwind breakpoint modifiers:
  - `sm:` → single-column grid, stats strip → 2×2, header ⌘K pill collapses to an icon-only `Button`
  - `md:` → 2-column grid
  - `lg:` → 3-column grid (default `auto-fill`)
- Touch targets ≥ 44×44px (shadcn `size="icon"` already compliant)
- Dialog on mobile: shadcn `Dialog` is already responsive

### 4.3 Performance sanity

- Debounce search input to 150ms via a small custom hook
- `content-visibility: auto` on off-screen repo cards via a utility class

**Deliverable:** keyboard-navigable, mobile-usable, screen-reader-sane dashboard.

---

## Files

### Modified (Dev 2 scope)

- `src/app/dashboard/page.tsx` — full refactor to shadcn, inline `SessionCard` removed, command palette wired
- `src/app/dashboard/loading.tsx` — shadcn `Skeleton`
- `src/components/dashboard/RepoCard.tsx` — shadcn `Card` + `Button` + `Badge` + pin button
- `src/components/dashboard/RepoList.tsx` — shadcn `Skeleton` for loading, `Card`+`Button` for empty/error
- `src/components/dashboard/CreateSession.tsx` — shadcn `Dialog` + `Select` + `Button`

### Created (Dev 2 scope)

- `src/components/dashboard/SessionCard.tsx`
- `src/components/dashboard/RecentSessions.tsx`
- `src/components/dashboard/StatsStrip.tsx`
- `src/components/dashboard/CommandPalette.tsx`

### Modified (requires coordination — announce in group chat)

- `src/app/globals.css` — shadcn init appends a block; manually reconcile to map shadcn tokens → existing custom tokens (Phase 0.3)
- `package.json` — adds `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `tailwindcss-animate`, plus ~10 `@radix-ui/react-*` packages, plus `cmdk`
- `src/store/repoStore.ts` — adds sort/filter state, `pinnedRepoIds`, `persist` middleware wrapping

### Created by shadcn (in shared `src/components/ui/`)

- `src/components/ui/button.tsx` (replaces hand-rolled `Button.tsx`)
- `src/components/ui/card.tsx`
- `src/components/ui/badge.tsx` (replaces stub `Badge.tsx`)
- `src/components/ui/input.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/dialog.tsx` (replaces hand-rolled `Modal.tsx`)
- `src/components/ui/command.tsx`
- `src/components/ui/popover.tsx`
- `src/components/ui/dropdown-menu.tsx`
- `src/components/ui/avatar.tsx` (replaces stub `Avatar.tsx`)
- `src/components/ui/skeleton.tsx`
- `src/components/ui/separator.tsx`
- `src/components/ui/tooltip.tsx`
- `src/components/ui/checkbox.tsx` (for filters popover)
- `src/lib/utils.ts` (exports `cn()`)
- `components.json` (repo root)

### Deleted

- `src/components/ui/Button.tsx` (hand-rolled — replaced by `button.tsx`)
- `src/components/ui/Modal.tsx` (hand-rolled — replaced by `dialog.tsx`)
- `src/components/ui/Avatar.tsx` (stub — replaced by `avatar.tsx`)
- `src/components/ui/Badge.tsx` (stub — replaced by `badge.tsx`)

### Not touched

- `src/components/ui/Loader.tsx`, `Toast.tsx`, `ErrorBoundary.tsx`
- `src/hooks/useAuth.ts`
- `src/app/api/*`, `src/lib/firebase/*`, `src/lib/github/*`, `src/lib/yjs/*`, `src/proxy.ts`
- `src/app/layout.tsx`
- `src/app/session/*`, `src/components/editor/*`, `src/components/session/*`, `src/components/chat/*`

---

## Reuse (don't re-invent)

- **Existing CSS variables in `globals.css`** — kept as source of truth; shadcn tokens alias to them
- **`useAuth()`** at `src/hooks/useAuth.ts` — consumed as-is, no contract change
- **`useSessionStore`** at `src/store/sessionStore.ts` — consumed by `StatsStrip`, `RecentSessions`, `CommandPalette`
- **Toast store** at `src/store/toastStore.ts` — currently unused by dashboard; wire up for pin-toggle, session-creation, command-palette-action feedback
- **`GitHubRepo` type** at `src/types/github.ts` — powers all repo display code

---

## Verification

After each phase:

1. `npm run lint` — 0 errors (existing warnings OK)
2. `npm run build` — succeeds
3. `npm run dev` — manual smoke:
   - **Phase 0:** dashboard looks identical. No console errors. Shadcn init applied cleanly.
   - **Phase 1:** dashboard looks (nearly) identical but is fully on shadcn. Buttons click, Dialogs open/close, Skeletons shimmer, DropdownMenu sign-out works. Zero hand-rolled modal or button in dashboard code.
   - **Phase 2:** visibly elevated. Hover lifts feel smooth. 640px width — still usable.
   - **Phase 3:**
     - Sort/filter: reorder instant, persists across reload
     - Pin star: fills on click, pinned repos rise to top, persists across reload
     - Stats tiles: numbers match data
     - ⌘K: palette opens, fuzzy matches, arrow keys + Enter work, Escape closes, clicking a repo opens CreateSession
     - Recent sessions: horizontal strip, Resume navigates correctly
   - **Phase 4:**
     - Keyboard only: Tab through every interactive element, visible focus rings, Enter/Space activate, Escape closes dialogs
     - DevTools mobile (iPhone 12): layout holds, dialog usable
     - Lighthouse Accessibility ≥ 95

**End-to-end:** sign in → dashboard → ⌘K → select repo → CreateSession dialog → create session → `/session/[id]`. All paths unchanged, prettier + more accessible.

---

## Out of scope

- Light theme / theme toggle (would require filling out `.dark` variants; app is dark-only)
- Migrating `Toast.tsx` → `sonner` (optional; can be done as a separate small task)
- Backend changes
- Editor, chat, auth, session room UI
- Virtualized repo list (premature)
- Unit tests (no test runner configured per `CLAUDE.md`)
