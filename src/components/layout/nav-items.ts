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
