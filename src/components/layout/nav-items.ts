import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Tags,
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
  }
];
