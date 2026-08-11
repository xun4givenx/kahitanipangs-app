"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NavContent } from "@/components/layout/nav-content";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b border-border/70 bg-card/95 px-4 backdrop-blur lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex w-72 flex-col p-0">
          <SheetHeader className="h-14 justify-center border-b border-border/40 px-4">
            <SheetTitle className="text-lg font-bold tracking-tight">
              KahitaNiPangs
            </SheetTitle>
          </SheetHeader>
          <NavContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
        <Image src="/icons/kp-wallet-192.png" alt="" width={32} height={32} className="h-8 w-8 rounded-full" priority />
        KahitaNiPangs
      </Link>
    </header>
  );
}
