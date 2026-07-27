import Link from "next/link";
import { NavContent } from "@/components/layout/nav-content";
import { Wallet } from "lucide-react";

export function Sidebar() {
  return (
    <aside className="hidden h-screen w-[260px] flex-col bg-sidebar border-r border-border lg:flex z-20">
      <div className="flex h-[72px] items-center px-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Wallet className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[15px] font-bold tracking-tight leading-tight text-sidebar-foreground">Ultima</div>
            <div className="text-[11px] font-medium text-muted-foreground leading-none mt-1">AI Dialer Platform</div>
          </div>
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto">
        <NavContent />
      </div>
    </aside>
  );
}
