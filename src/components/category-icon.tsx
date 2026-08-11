import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export const EXPENSE_CATEGORIES = [
  "Food & groceries",
  "Transport",
  "Transportation expense",
  "Gas & fuel",
  "Bills & utilities",
  "Rent & home",
  "House mortgage",
  "Car mortgage",
  "Motorcycle mortgage",
  "Shopping",
  "Health",
  "Entertainment",
  "Debt payment",
  "Kids allowances",
  "Telco load",
  "Other spending",
] as const;

const icons: Record<string, string> = {
  "Food & groceries": "🛒",
  Transport: "🚌",
  "Transportation expense": "🚍",
  "Gas & fuel": "⛽",
  "Bills & utilities": "🧾",
  "Rent & home": "🏠",
  "House mortgage": "🏡",
  "Car mortgage": "🚘",
  "Motorcycle mortgage": "🏍️",
  Shopping: "🛍️",
  Health: "💗",
  Entertainment: "🎬",
  "Debt payment": "💳",
  "Kids allowances": "🧒",
  "Telco load": "📱",
  "Other spending": "✨",
};

const tones: Record<string, { background: string; color: string; shadow: string }> = {
  "Food & groceries": { background: "#ffe5ef", color: "#bd5f88", shadow: "rgba(189, 95, 136, .16)" },
  Transport: { background: "#e9e5ff", color: "#7060ce", shadow: "rgba(112, 96, 206, .16)" },
  "Transportation expense": { background: "#e4f0ff", color: "#547dbd", shadow: "rgba(84, 125, 189, .16)" },
  "Gas & fuel": { background: "#fff0df", color: "#c78145", shadow: "rgba(199, 129, 69, .16)" },
  "Bills & utilities": { background: "#e7f0ff", color: "#5e82c6", shadow: "rgba(94, 130, 198, .16)" },
  "Rent & home": { background: "#f1e9ff", color: "#8b66c7", shadow: "rgba(139, 102, 199, .16)" },
  "House mortgage": { background: "#ede7ff", color: "#7763cb", shadow: "rgba(119, 99, 203, .16)" },
  "Car mortgage": { background: "#ffe9f0", color: "#bf6688", shadow: "rgba(191, 102, 136, .16)" },
  "Motorcycle mortgage": { background: "#e7f5f4", color: "#4f9a93", shadow: "rgba(79, 154, 147, .16)" },
  Shopping: { background: "#ffe8f5", color: "#c85e9c", shadow: "rgba(200, 94, 156, .16)" },
  Health: { background: "#ffe9e9", color: "#ce6b77", shadow: "rgba(206, 107, 119, .16)" },
  Entertainment: { background: "#f5e8ff", color: "#a064c9", shadow: "rgba(160, 100, 201, .16)" },
  "Debt payment": { background: "#f0efff", color: "#7065bd", shadow: "rgba(112, 101, 189, .16)" },
  "Kids allowances": { background: "#fff0e7", color: "#bd754f", shadow: "rgba(189, 117, 79, .16)" },
  "Telco load": { background: "#e6f7f0", color: "#4b9b7b", shadow: "rgba(75, 155, 123, .16)" },
  "Other spending": { background: "#f3eef8", color: "#83758e", shadow: "rgba(131, 117, 142, .16)" },
};

export function CategoryIcon({ category, className }: { category: string; className?: string }) {
  return <span className={cn("category-emoji", className)} aria-hidden="true">{icons[category] || "🏷️"}</span>;
}

export function CategoryIconBadge({ category, className, compact = false }: { category: string; className?: string; compact?: boolean }) {
  const tone = tones[category] || { background: "#f0ecf8", color: "#776d8f", shadow: "rgba(119, 109, 143, .14)" };
  const style = { background: `linear-gradient(145deg, #ffffff 0%, ${tone.background} 55%, ${tone.background} 100%)`, color: tone.color, boxShadow: `0 7px 16px ${tone.shadow}` } as CSSProperties;
  return <span className={cn("category-icon-badge", compact && "category-icon-badge-compact", className)} style={style}><CategoryIcon category={category} /></span>;
}
