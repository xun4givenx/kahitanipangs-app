import Link from "next/link";
import { NavContent } from "@/components/layout/nav-content";
import { Wallet } from "lucide-react";

export function Sidebar() {
  return (
    <aside className="hidden h-screen w-[280px] flex-col bg-sidebar/95 backdrop-blur-md border-r border-border/50 lg:flex shadow-[4px_0_24px_rgba(0,0,0,0.2)] z-20">
      <div className="flex h-[72px] items-center px-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 border border-primary/30">
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          <span className="text-lg font-bold tracking-tight text-sidebar-foreground">Money Manager</span>
        </Link>
      </div>
      <div className="px-4 py-2 flex-1 overflow-y-auto">
        <NavContent />
      </div>
    </aside>
  );
}
