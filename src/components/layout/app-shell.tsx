"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Bell, Heart } from "lucide-react";
import { usePathname } from "next/navigation";
import { navGroups } from "@/components/layout/nav-items";
import { ManilaClock } from "@/components/layout/manila-clock";
import { BudgetAlert } from "@/components/budget-alert";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Find the current page label for the header
  let currentPage = "Overview";
  for (const group of navGroups) {
    const item = group.items.find(i => i.href === pathname);
    if (item) {
      currentPage = item.label;
      break;
    }
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col z-10 min-w-0">
        <MobileNav />
        {/* Top Header Bar */}
        <header className="hidden lg:flex h-[76px] items-center justify-between border-b border-border px-8 bg-background/95 backdrop-blur">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary/70">KahitaNiPangs</p>
              <h1 className="mt-0.5 text-xl font-bold tracking-tight">{currentPage}</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ManilaClock />
            <div className="flex h-9 items-center gap-2 rounded-full border border-border bg-card px-3 text-xs font-semibold text-primary">
              <Heart className="h-3.5 w-3.5 fill-current" /> Together
            </div>
            <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground">
              <Bell className="h-5 w-5" />
            </Button>
          </div>
        </header>
        
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-background">
          <div className="p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
      <BudgetAlert />
      <Toaster />
    </div>
  );
}
