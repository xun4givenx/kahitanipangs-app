"use client";

import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { navGroups } from "@/components/layout/nav-items";

export function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex flex-col h-full">
      <nav className="flex-1 space-y-6 p-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            <h4 className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">
              {group.label}
            </h4>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => onNavigate?.()}
                    className={cn(
                      "group flex touch-manipulation cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={cn("h-[18px] w-[18px]", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                      {item.label}
                    </div>
                    {item.badge && (
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold",
                        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}>
                        {item.badge}
                      </span>
                    )}
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-border/50 p-4 bg-background/50">
        <Button
          variant="ghost"
          className="flex-1 justify-start gap-3 text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={handleLogout}
        >
          <LogOut className="h-[18px] w-[18px]" />
          Sign out
        </Button>
      </div>
    </div>
  );
}
