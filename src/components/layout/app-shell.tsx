"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { usePathname } from "next/navigation";
import { navGroups } from "@/components/layout/nav-items";
import { ManilaClock } from "@/components/layout/manila-clock";

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
        <header className="hidden lg:flex h-[72px] items-center justify-between border-b border-border px-8 bg-background">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold tracking-tight">{currentPage}</h1>
          </div>
          <div className="flex items-center gap-4">
            <ManilaClock />
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <Bell className="h-5 w-5" />
            </Button>
          </div>
        </header>
        
        <main className="flex-1 overflow-auto bg-[#0E0F14]"> {/* Slightly darker inside content like mockup */}
          <div className="p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
