# Mobile & Cross-Device Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the money-manager UI reactive across phone, tablet/iPad, laptop, and desktop without changing the desktop (`lg`+) layout.

**Architecture:** Additive Tailwind breakpoints layered onto existing markup. A shared `NavContent` renders the navigation once, consumed by the desktop sidebar (`hidden lg:flex`) and a new mobile top-bar + `Sheet` drawer (`lg:hidden`). Data tables get horizontal-scroll wrappers; Transactions and Loans additionally render stacked cards below `md`. No business logic or data flow changes.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS (default breakpoints), shadcn/ui (`Sheet` already installed), Vitest (node env), Playwright MCP for browser verification.

## Global Constraints

- **Desktop unchanged at `lg`+ (≥1024px):** every responsive class must resolve to the *current* markup at `lg` and above. Verified side-by-side at 1280px per task.
- **Breakpoints:** phone = base, `sm:` ≥640, `md:` ≥768, `lg:` ≥1024, `xl:` ≥1280. No custom `screens` config.
- **No new dependencies.** `Sheet` is already in `src/components/ui/sheet.tsx`.
- **DRY:** navigation defined once in `nav-items.ts` + `nav-content.tsx`; per-row actions extracted to a single helper before duplicating a list into cards.
- **Verification is browser-driven.** These are visual/layout changes; the repo's Vitest is node-only, so component layout is verified by driving a real browser (Playwright MCP) at 375px / 768px / 1280px and asserting no horizontal page overflow. Only pure-data modules (`nav-items.ts`) get unit tests — className snapshots are brittle and are not used.
- **Commands:** dev server `npm run dev` (http://localhost:3000); typecheck/build `npm run build`; unit tests `npm run test`.

---

## File Structure

- `src/components/layout/nav-items.ts` **(new)** — the single source of nav entries (data only).
- `src/components/layout/nav-content.tsx` **(new)** — renders nav links (active state) + footer (sign out + theme toggle); used by both sidebar and mobile drawer.
- `src/components/layout/sidebar.tsx` **(modify)** — desktop-only chrome wrapping `NavContent`; `hidden lg:flex`.
- `src/components/layout/mobile-nav.tsx` **(new)** — sticky top bar + hamburger + `Sheet` drawer; `lg:hidden`.
- `src/components/layout/app-shell.tsx` **(modify)** — compose sidebar + mobile top bar + main; responsive padding.
- `src/app/transactions/page.tsx` **(modify)** — table scroll wrapper + mobile card variant.
- `src/app/loans/page.tsx` **(modify)** — table scroll wrapper + mobile card variant.
- `src/app/page.tsx`, `src/app/debts/page.tsx`, `src/app/ledger/page.tsx`, `src/app/ledger/trial-balance/page.tsx`, `src/app/ledger/accounts/[id]/page.tsx` **(modify)** — table scroll wrappers.
- `src/app/layout.tsx` **(modify)** — explicit `viewport` export.
- `tests/nav-items.test.ts` **(new)** — nav data invariants.

---

## Task 1: Shared navigation + desktop-only sidebar

**Files:**
- Create: `src/components/layout/nav-items.ts`
- Create: `src/components/layout/nav-content.tsx`
- Create: `tests/nav-items.test.ts`
- Modify: `src/components/layout/sidebar.tsx`

**Interfaces:**
- Produces: `navItems: { href: string; label: string; icon: LucideIcon }[]` from `nav-items.ts`.
- Produces: `NavContent({ onNavigate }: { onNavigate?: () => void })` from `nav-content.tsx` — renders the nav list and footer; calls `onNavigate?.()` on any link click.

- [ ] **Step 1: Write the failing test**

Create `tests/nav-items.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { navItems } from "@/components/layout/nav-items";

describe("navItems", () => {
  it("has the 9 expected sections", () => {
    expect(navItems).toHaveLength(9);
  });

  it("every entry has a unique href, a label, and an icon", () => {
    const hrefs = navItems.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const item of navItems) {
      expect(item.href).toMatch(/^\//);
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.icon).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- nav-items`
Expected: FAIL — cannot resolve `@/components/layout/nav-items`.

- [ ] **Step 3: Create `nav-items.ts`**

```ts
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Tags,
  CreditCard,
  HandCoins,
  BookOpen,
  Scale,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/accounts", label: "Accounts", icon: Wallet },
  { href: "/categories", label: "Categories", icon: Tags },
  { href: "/debts", label: "Debts", icon: CreditCard },
  { href: "/loans", label: "Loans", icon: HandCoins },
  { href: "/ledger", label: "Ledger", icon: BookOpen },
  { href: "/ledger/accounts", label: "Chart of Accounts", icon: Wallet },
  { href: "/ledger/trial-balance", label: "Trial Balance", icon: Scale },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- nav-items`
Expected: PASS (2 tests).

- [ ] **Step 5: Create `nav-content.tsx`** (moves the link list + logout + theme toggle out of the sidebar)

```tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import { navItems } from "@/components/layout/nav-items";

export function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onNavigate?.()}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex items-center justify-between gap-2 border-t border-border/40 p-4">
        <Button
          variant="ghost"
          className="flex-1 justify-start gap-3"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
        <ThemeToggle />
      </div>
    </>
  );
}
```

- [ ] **Step 6: Rewrite `sidebar.tsx`** to be desktop-only chrome around `NavContent`

Replace the entire file with:

```tsx
import Link from "next/link";
import { NavContent } from "@/components/layout/nav-content";

export function Sidebar() {
  return (
    <aside className="hidden h-screen w-64 flex-col bg-card shadow-sm lg:flex">
      <div className="flex h-16 items-center border-b border-border/40 px-6">
        <Link href="/" className="text-xl font-bold tracking-tight">
          Money Manager
        </Link>
      </div>
      <NavContent />
    </aside>
  );
}
```

- [ ] **Step 7: Typecheck**

Run: `npm run build`
Expected: compiles with no type errors.

- [ ] **Step 8: Browser check — desktop unchanged**

Start `npm run dev`. With Playwright MCP: navigate to http://localhost:3000, resize to 1280×800, snapshot.
Expected: sidebar looks identical to before (title, 9 links, active highlight, sign-out + theme toggle at bottom). Clicking each link still navigates and highlights.

- [ ] **Step 9: Commit**

```bash
git add src/components/layout/nav-items.ts src/components/layout/nav-content.tsx src/components/layout/sidebar.tsx tests/nav-items.test.ts
git commit -m "refactor(nav): extract shared NavContent; sidebar desktop-only (lg+)"
```

---

## Task 2: Mobile top bar + drawer

**Files:**
- Create: `src/components/layout/mobile-nav.tsx`
- Modify: `src/components/layout/app-shell.tsx`

**Interfaces:**
- Consumes: `NavContent` (Task 1), `Sheet`/`SheetContent`/`SheetTrigger`/`SheetHeader`/`SheetTitle` from `@/components/ui/sheet`.
- Produces: `MobileNav()` from `mobile-nav.tsx` — a sticky top bar shown only below `lg`.

- [ ] **Step 1: Create `mobile-nav.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NavContent } from "@/components/layout/nav-content";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border/40 bg-card px-4 lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex w-72 flex-col p-0">
          <SheetHeader className="h-14 justify-center border-b border-border/40 px-4">
            <SheetTitle className="text-lg font-bold tracking-tight">
              Money Manager
            </SheetTitle>
          </SheetHeader>
          <NavContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <Link href="/" className="text-lg font-bold tracking-tight">
        Money Manager
      </Link>
    </header>
  );
}
```

- [ ] **Step 2: Update `app-shell.tsx`** to add the mobile bar and responsive padding

Replace the file with:

```tsx
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Toaster } from "@/components/ui/sonner";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <MobileNav />
        <main className="flex-1 overflow-auto bg-background">
          <div className="container mx-auto max-w-7xl p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run build`
Expected: compiles cleanly.

- [ ] **Step 4: Browser check — mobile nav works, desktop unchanged**

With `npm run dev` running, using Playwright MCP:
1. Resize to 375×812, navigate to http://localhost:3000. Expected: no desktop sidebar; a top bar with a hamburger + "Money Manager" is visible; page content uses full width.
2. Click the hamburger. Expected: drawer slides in from the left showing all 9 links + sign out + theme toggle.
3. Click "Transactions". Expected: navigates to /transactions AND the drawer closes.
4. Resize to 1280×800. Expected: top bar is hidden, desktop sidebar visible, layout identical to Task 1.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/mobile-nav.tsx src/components/layout/app-shell.tsx
git commit -m "feat(nav): mobile top bar + slide-out drawer below lg"
```

---

## Task 3: Table horizontal-scroll wrappers

Wrap every `<Table>` so it scrolls inside its own container and never forces the page to scroll sideways. Each wrapper is: `<div className="w-full overflow-x-auto">…</div>` directly around the `<Table>` element.

**Files (each has one or more `<Table>`):**
- Modify: `src/app/transactions/page.tsx` (2 tables: ~line 339, ~line 387)
- Modify: `src/app/loans/page.tsx` (1 table: ~line 539)
- Modify: `src/app/debts/page.tsx` (3 tables: ~line 269, ~line 345, ~line 397)
- Modify: `src/app/page.tsx` (1 table: ~line 357)
- Modify: `src/app/ledger/page.tsx` (all `<Table>`)
- Modify: `src/app/ledger/trial-balance/page.tsx` (all `<Table>`)
- Modify: `src/app/ledger/accounts/[id]/page.tsx` (all `<Table>`)

- [ ] **Step 1: Wrap each table.** For every occurrence, change:

```tsx
<Table>
  …
</Table>
```

into:

```tsx
<div className="w-full overflow-x-auto">
  <Table>
    …
  </Table>
</div>
```

Locate them with: `grep -rn "<Table>" src/app --include=*.tsx` and wrap each. (Leave the two tables in Transactions/Loans wrapped too — Tasks 4 and 5 add the `hidden md:block` visibility on top of this wrapper.)

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: compiles cleanly.

- [ ] **Step 3: Browser check — no page-level horizontal scroll**

With `npm run dev`, using Playwright MCP at 375×812, for each of `/`, `/transactions`, `/loans`, `/debts`, `/ledger`, `/ledger/trial-balance`: navigate and evaluate:

```js
document.documentElement.scrollWidth <= window.innerWidth + 1
```

Expected: `true` on every page (the page body does not overflow horizontally; any overflow is contained to the table wrapper).

- [ ] **Step 4: Commit**

```bash
git add src/app
git commit -m "fix(tables): wrap data tables in horizontal-scroll containers"
```

---

## Task 4: Transactions mobile card variant

Below `md`, hide the "All Transactions" table and show a stacked-card list built from the **same** `transactions` array and handlers. Extract the row action buttons to a single helper so the table and cards never drift.

**Files:**
- Modify: `src/app/transactions/page.tsx`

**Interfaces:**
- Consumes: existing in-scope values `transactions`, `formatDate`, `formatCurrency`, `openEdit`, `handleDuplicate`, `handleDelete`, and the `Pencil`/`Copy`/`Trash2` icons.

- [ ] **Step 1: Add a row-actions helper** inside the component (near the other handlers, before the `return`):

```tsx
function txActions(t: (typeof transactions)[number]) {
  return (
    <div className="flex gap-1">
      <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => handleDuplicate(t.id)}>
        <Copy className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Use the helper in the existing table cell.** Replace the action `<div className="flex gap-1"> … </div>` block inside the table (around lines 361–365) with:

```tsx
{txActions(t)}
```

- [ ] **Step 3: Gate the table to `md`+.** Change the table's scroll wrapper (from Task 3) opening tag for the "All Transactions" table from:

```tsx
<div className="w-full overflow-x-auto">
```

to:

```tsx
<div className="hidden w-full overflow-x-auto md:block">
```

- [ ] **Step 4: Add the mobile card list** immediately after that table's closing `</div>` (still inside the `transactions.length ?` truthy branch), so both render from the same condition:

```tsx
<div className="space-y-3 md:hidden">
  {transactions.map((t) => (
    <div key={t.id} className="rounded-lg border border-border/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{t.description}</p>
          <p className="text-xs text-muted-foreground">
            {formatDate(t.date)} · {(t.accounts as { name: string })?.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {(t.categories as { name: string })?.name || "—"}
          </p>
        </div>
        <span
          className={`shrink-0 font-medium ${
            t.type === "income" ? "text-green-600" : "text-red-600"
          }`}
        >
          {t.type === "income" ? "+" : "-"}
          {formatCurrency(t.amount)}
        </span>
      </div>
      <div className="mt-2 flex justify-end">{txActions(t)}</div>
    </div>
  ))}
</div>
```

- [ ] **Step 5: Typecheck**

Run: `npm run build`
Expected: compiles cleanly.

- [ ] **Step 6: Browser check**

With `npm run dev`, using Playwright MCP:
1. At 375×812 on `/transactions`: expected — cards (one per transaction) show description, date · account, category, signed amount, and the three action buttons; no wide table visible; no page horizontal scroll.
2. Tap a card's edit button — expected: the edit dialog opens (same as desktop).
3. At 1280×800: expected — the table renders exactly as before, no cards visible.

- [ ] **Step 7: Commit**

```bash
git add src/app/transactions/page.tsx
git commit -m "feat(transactions): stacked-card list on phones (<md)"
```

---

## Task 5: Loans mobile card variant

Same pattern for the "Existing borrowers" table: extract the busy action cluster to a helper, gate the table to `md`+, add a card list below `md`.

**Files:**
- Modify: `src/app/loans/page.tsx`

**Interfaces:**
- Consumes: in-scope `loans`, `loanProfit`, `getMonthlyFlow`, `getNextPaymentDate`, `formatCurrency`, `collectingId`, `handleCollect`, `openManualCollect`, `openRefund`, `openHistory`, `handleEdit`, `handleDelete`, and icons `Coins`/`Receipt`/`Undo2`/`History`/`Pencil`/`Trash2`/`PiggyBank`.

- [ ] **Step 1: Add a row-actions helper** inside the component (before `return`), lifting the exact action cluster from the table cell (lines ~591–630):

```tsx
function loanActions(loan: (typeof loans)[number]) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="outline"
        size="sm"
        disabled={collectingId === loan.id}
        onClick={() => handleCollect(loan)}
        title="Record today's collection"
      >
        <Coins className="mr-1 h-3.5 w-3.5" />
        Collect
      </Button>
      <Button variant="ghost" size="icon" onClick={() => openManualCollect(loan)} title="Record collection (custom amount/date)">
        <Receipt className="h-4 w-4" />
      </Button>
      {Number(loan.savings_balance || 0) > 0 && (
        <Button variant="ghost" size="icon" onClick={() => openRefund(loan)} title="Refund savings">
          <Undo2 className="h-4 w-4" />
        </Button>
      )}
      <Button variant="ghost" size="icon" onClick={() => openHistory(loan)} title="Collection history">
        <History className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => handleEdit(loan)} title="Edit loan">
        <Pencil className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => handleDelete(loan.id)} title="Delete loan">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Use the helper in the table cell.** Replace the entire action `<div className="flex items-center justify-end gap-1"> … </div>` block (lines ~592–630) inside the last `<TableCell>` with:

```tsx
{loanActions(loan)}
```

- [ ] **Step 3: Gate the table to `md`+.** Change the Loans table's scroll wrapper (from Task 3) from:

```tsx
<div className="w-full overflow-x-auto">
```

to:

```tsx
<div className="hidden w-full overflow-x-auto md:block">
```

- [ ] **Step 4: Add the mobile card list** immediately after that table's closing `</div>`, inside the same `<CardContent>`:

```tsx
<div className="space-y-3 md:hidden">
  {loans.length === 0 ? (
    <div className="py-10 text-center text-muted-foreground">
      <HandCoins className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
      No loans yet. Add your first borrower to get started.
    </div>
  ) : (
    loans.map((loan) => {
      const { expected, realized } = loanProfit(loan);
      const progress = expected > 0 ? Math.min(100, (realized / expected) * 100) : 0;
      return (
        <div key={loan.id} className="rounded-lg border border-border/60 p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium">{loan.person_name}</p>
            <span className="text-sm capitalize text-muted-foreground">{loan.frequency}</span>
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Outstanding</dt>
            <dd className="text-right font-medium">{formatCurrency(loan.remaining_balance || 0)}</dd>
            <dt className="text-muted-foreground">Payment</dt>
            <dd className="text-right">{formatCurrency(getMonthlyFlow(loan))}</dd>
            <dt className="text-muted-foreground">Next due</dt>
            <dd className="text-right">{getNextPaymentDate(loan)}</dd>
            <dt className="text-muted-foreground">Savings held</dt>
            <dd className="text-right">{formatCurrency(loan.savings_balance || 0)}</dd>
            <dt className="text-muted-foreground">Profit</dt>
            <dd className="text-right">
              {formatCurrency(expected)}{" "}
              <span className="text-xs text-chart-2">({formatCurrency(realized)} earned)</span>
            </dd>
          </dl>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-chart-2" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap justify-end gap-1">{loanActions(loan)}</div>
        </div>
      );
    })
  )}
</div>
```

- [ ] **Step 5: Typecheck**

Run: `npm run build`
Expected: compiles cleanly.

- [ ] **Step 6: Browser check**

With `npm run dev`, using Playwright MCP:
1. At 375×812 on `/loans`: expected — one card per borrower showing name, frequency, outstanding/payment/next due/savings/profit, a progress bar, and the action buttons wrapping onto their own line; no wide table; no page horizontal scroll.
2. Tap "Collect" on a card — expected: same behavior as desktop (collection recorded / disabled while collecting).
3. At 1280×800: expected — the borrowers table renders exactly as before; no cards visible.

- [ ] **Step 7: Commit**

```bash
git add src/app/loans/page.tsx
git commit -m "feat(loans): stacked-card list on phones (<md)"
```

---

## Task 6: Form-dialog grids + viewport meta

Two-field form rows that use a hard `grid-cols-2` get cramped on phones; make them stack. Also declare the viewport explicitly.

**Files:**
- Modify: `src/app/transactions/page.tsx` (form rows at ~lines 170, 202, 227)
- Modify: `src/app/debts/page.tsx` (form rows at ~lines 227, 237)
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Make dialog form rows responsive.** In the two files above, for each occurrence of a form field row, change:

```tsx
<div className="grid grid-cols-2 gap-4">
```

to:

```tsx
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
```

Find them with: `grep -rn 'grid grid-cols-2 gap-4' src/app/transactions/page.tsx src/app/debts/page.tsx`. (Do **not** touch page-level card grids that already carry `sm:`/`lg:` prefixes — those are correct.)

- [ ] **Step 2: Add an explicit `viewport` export** to `src/app/layout.tsx`. After the existing `metadata` export (line ~21), add:

```tsx
import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};
```

(Merge the `Viewport` type into the existing `import type { Metadata } from "next";` line rather than duplicating the import.)

- [ ] **Step 3: Typecheck**

Run: `npm run build`
Expected: compiles cleanly.

- [ ] **Step 4: Browser check**

With `npm run dev`, using Playwright MCP at 375×812:
1. On `/transactions`, open the add-transaction dialog — expected: the paired fields stack vertically (one per row), each full width and comfortably tappable.
2. On `/debts`, open the add-debt dialog — same stacking behavior.
3. Confirm the rendered `<head>` contains `<meta name="viewport" content="width=device-width, initial-scale=1">`.

- [ ] **Step 5: Commit**

```bash
git add src/app/transactions/page.tsx src/app/debts/page.tsx src/app/layout.tsx
git commit -m "fix(forms): stack dialog field rows on phones; explicit viewport"
```

---

## Task 7: Cross-device verification sweep

Final confirmation across all tiers. No code unless a defect is found; if one is, fix it in the owning task's file and re-commit.

- [ ] **Step 1: Run the full unit suite**

Run: `npm run test`
Expected: all tests pass (including `nav-items`).

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: build succeeds, no type errors.

- [ ] **Step 3: Multi-width browser sweep** with `npm run dev` + Playwright MCP.

For each width in {375 (phone), 768 (iPad portrait), 1024 (iPad landscape/laptop), 1280 (desktop)} and each route in {`/`, `/transactions`, `/accounts`, `/categories`, `/debts`, `/loans`, `/ledger`, `/ledger/trial-balance`}:
- Navigate and assert `document.documentElement.scrollWidth <= window.innerWidth + 1` (no page-level horizontal scroll).
- Below 1024: the hamburger top bar is present and the desktop sidebar is absent.
- At 1024 and 1280: the desktop sidebar is present and the top bar is absent.

Expected: all assertions hold. At 1280 every page must look identical to pre-change (spot-check against the Global Constraints "desktop unchanged" rule).

- [ ] **Step 4: Record completion**

No commit needed unless a fix was made. If fixes were made, they were committed under their owning task. The branch is ready for review/merge.

---

## Self-Review Notes

- **Spec coverage:** shell/nav (Tasks 1–2), responsive grids (page grids already responsive; dialog grids handled in Task 6), table scroll wrappers (Task 3), Transactions/Loans cards (Tasks 4–5), viewport (Task 6), verification (Task 7). All spec sections mapped.
- **Scope correction vs. spec:** page-level card grids were found already responsive (`sm:`/`lg:` prefixes present); the only grid work needed is dialog field rows — reflected in Task 6.
- **Type consistency:** `NavContent`, `navItems`, `txActions`, `loanActions` names are used consistently across tasks. Helpers consume only values already in each page's scope.
