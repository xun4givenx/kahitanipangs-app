import {
  LayoutDashboard,
  ArrowLeftRight,
  PiggyBank,
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
      { href: "/budget", label: "Budget", icon: PiggyBank },
    ]
  }
];
