# Mobile & Cross-Device Responsive Design

**Date:** 2026-07-18
**Status:** Approved (brainstorming complete)
**App:** money-manager (Next.js 14 App Router + Tailwind + shadcn/ui)

## Problem

The app was built desktop-only and is unusable on mobile:

1. **Fixed sidebar.** `sidebar.tsx` renders a permanent `w-64` (256px), `h-screen` aside inside a flex row with the content (`app-shell.tsx`). On a ~375px phone it consumes two-thirds of the screen. There is no hamburger, drawer, or responsive collapse.
2. **Non-responsive grids.** The Dashboard uses hard `grid-cols-3/4/5` and other pages use `grid-cols-2/3` with no breakpoints, so cards are crushed into unreadable slivers on small screens.
3. **Responsiveness was never applied.** Only 5 files use any `sm:`/`md:` classes.
4. **Data tables.** 7 pages use the shadcn `<Table>` component (Transactions, Loans, Debts, Dashboard, Ledger, Ledger account register, Trial Balance). Tables do not stack and overflow the viewport horizontally.

Favourable starting conditions: Tailwind + shadcn/ui, no raw `<table>` elements, and the `Sheet` (drawer) component is already installed.

## Goal

Make the UI reactive across all device tiers — phone, large phone, tablet/iPad, laptop, desktop — at a "usable + polished" level. The existing desktop layout must remain visually unchanged at `lg`+.

## Breakpoint Strategy

Use Tailwind's default breakpoints, which map directly onto the target device tiers:

| Tier | Width | Tailwind prefix |
|------|-------|-----------------|
| Phone | < 640px | (base) |
| Large phone / small tablet | ≥ 640px | `sm:` |
| iPad / tablet portrait | ≥ 768px | `md:` |
| iPad landscape / laptop | ≥ 1024px | `lg:` |
| Desktop | ≥ 1280px | `xl:` |

No custom `screens` config is needed.

## Design

### Layer 1 — Responsive shell & navigation

- Extract the 9 nav items into one shared source (e.g. `nav-items.ts`) consumed by both the desktop sidebar and the mobile drawer, so they never drift apart.
- **Desktop (`lg`+):** current `Sidebar` unchanged.
- **Below `lg`:** hide the fixed sidebar. Render a sticky top bar (app title + hamburger button). The hamburger opens the full nav inside a `Sheet` drawer (already installed — no new dependency). Sign-out and the theme toggle live in the drawer footer, mirroring the current sidebar footer.
- `app-shell.tsx` composes: sticky mobile top bar (hidden `lg`+) + desktop sidebar (hidden below `lg`) + main content. Main content padding tightens on mobile (`p-4` → `lg:p-6`).

**Boundaries:** shell owns layout/nav-visibility only; pages own their own content. The shared nav list is the single interface between sidebar and drawer.

### Layer 2 — Responsive page grids

Replace hard `grid-cols-N` with breakpoint-aware variants across Dashboard, Accounts, Categories, Debts, Loans, Transactions. Pattern examples:

- Dashboard stat cards: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`.
- Secondary card grids: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.
- Dialogs/modals: full-width with comfortable margins on phones.

Everything stacks to 1–2 columns on phones and fans out on larger screens.

### Layer 3 — Data tables

- **All 7 tables:** wrap in a horizontal-scroll container (`overflow-x-auto` on a bounded wrapper) so nothing overflows the page body. Safe, fast, no data loss. The page itself must never scroll sideways — only the table's own container does.
- **Transactions and Loans (highest-traffic lists):** additionally render as stacked cards below `md` (< 768px — phones and small tablets), with the table shown at `md`+. Each card surfaces the key fields (date, description/borrower, amount, category/status) with row actions preserved. Ledger and trial-balance tables keep scroll-only, since they are genuinely tabular.

### Out of scope (future phase)

PWA / native wrapper. Once responsive lands, shipping as a PWA (manifest + service worker) is ~1–2 days, and a Capacitor wrapper (~1 week) reuses ~95% of the code for App Store / Play Store presence with native login/push. React Native is a rewrite and not recommended. Tracked as a separate spec.

## Testing / Verification

- Verify each affected page at phone (375px), tablet (768px), and desktop (1280px) widths in a real browser.
- Assert: no horizontal page overflow at any width; nav reachable via hamburger below `lg`; all controls tappable (≥44px touch targets); tables scroll within their container, not the page.
- Confirm the desktop layout (`lg`+) is visually unchanged from current.
- Confirm Next.js emits the default viewport meta (`width=device-width, initial-scale=1`); add an explicit `viewport` export in `layout.tsx` if absent.

## Affected Files (indicative)

- `src/components/layout/app-shell.tsx` — responsive shell composition
- `src/components/layout/sidebar.tsx` — consume shared nav list; desktop-only visibility
- `src/components/layout/nav-items.ts` (new) — shared nav source
- `src/components/layout/mobile-nav.tsx` (new) — top bar + Sheet drawer
- `src/app/page.tsx`, `accounts`, `categories`, `debts`, `loans`, `transactions` — responsive grids
- `src/app/transactions/page.tsx`, `src/app/loans/page.tsx` — mobile card variants
- Ledger pages — table scroll wrappers
- `src/app/layout.tsx` — viewport export (if needed)
