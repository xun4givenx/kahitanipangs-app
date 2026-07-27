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

export type NavItem = { href: string; label: string; icon: LucideIcon; badge?: string };

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    label: "PLATFORM",
    items: [
      { href: "/", label: "Overview", icon: LayoutDashboard },
    ]
  },
  {
    label: "01 CORE FINANCES",
    items: [
      { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
      { href: "/accounts", label: "Accounts", icon: Wallet },
      { href: "/categories", label: "Categories", icon: Tags },
    ]
  },
  {
    label: "02 CREDIT & LOANS",
    items: [
      { href: "/debts", label: "Debts", icon: CreditCard },
      { href: "/loans", label: "Loans", icon: HandCoins },
    ]
  },
  {
    label: "03 ACCOUNTING",
    items: [
      { href: "/ledger", label: "Ledger", icon: BookOpen },
      { href: "/ledger/accounts", label: "Chart of Accounts", icon: Wallet },
      { href: "/ledger/trial-balance", label: "Trial Balance", icon: Scale },
    ]
  }
];
