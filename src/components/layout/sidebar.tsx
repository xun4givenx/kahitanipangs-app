import Link from "next/link";
import Image from "next/image";
import { NavContent } from "@/components/layout/nav-content";

export function Sidebar() {
  return (
    <aside className="hidden h-screen w-[264px] flex-col bg-sidebar border-r border-border lg:flex z-20">
      <div className="flex h-[72px] items-center px-6">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/kp-wallet.svg" alt="" width={36} height={36} className="h-9 w-9 rounded-full shadow-lg shadow-primary/20" priority />
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
