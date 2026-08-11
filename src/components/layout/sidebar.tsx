import Link from "next/link";
import { NavContent } from "@/components/layout/nav-content";
import { HeartHandshake } from "lucide-react";

export function Sidebar() {
  return (
    <aside className="hidden h-screen w-[264px] flex-col bg-sidebar border-r border-border lg:flex z-20">
      <div className="flex h-[72px] items-center px-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <HeartHandshake className="h-[18px] w-[18px]" />
          </div>
          <div>
            <div className="text-[15px] font-bold tracking-tight leading-tight text-sidebar-foreground">KahitaNiPangs</div>
            <div className="text-[11px] font-medium text-muted-foreground leading-none mt-1">Better, together</div>
          </div>
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto">
        <NavContent />
      </div>
    </aside>
  );
}
