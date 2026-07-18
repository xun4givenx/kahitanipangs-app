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
