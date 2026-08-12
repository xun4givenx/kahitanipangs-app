import {
  LayoutDashboard,
  ArrowLeftRight,
  PiggyBank,
  CreditCard,
  ReceiptText,
  Tags,
  WalletCards,
  HandCoins,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; badge?: string };

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    label: "CASH FLOW",
    items: [
      { href: "/", label: "Cash overview", icon: LayoutDashboard },
    ]
  },
  {
    label: "CASH BOOK",
    items: [
      { href: "/transactions", label: "All cash records", icon: ArrowLeftRight },
      { href: "/accounts", label: "Accounts", icon: WalletCards },
      { href: "/loans", label: "Loans out", icon: HandCoins },
      { href: "/debts", label: "Debt accounts", icon: CreditCard },
      { href: "/budget", label: "Budget", icon: PiggyBank },
      { href: "/expenses", label: "Expenses", icon: ReceiptText },
      { href: "/categories", label: "Categories", icon: Tags },
    ]
  }
];
