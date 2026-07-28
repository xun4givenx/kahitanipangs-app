"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

export function ManilaClock() {
  const [time, setTime] = useState<string>("");
  const [date, setDate] = useState<string>("");

  useEffect(() => {
    function updateClock() {
      const now = new Date();
      setTime(
        new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Manila",
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }).format(now)
      );
      setDate(
        new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Manila",
          weekday: "short",
          month: "short",
          day: "numeric",
        }).format(now)
      );
    }

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!time) return null; // Avoid hydration mismatch

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-full border border-border/50">
      <Clock className="h-4 w-4 text-primary" />
      <span className="font-medium text-foreground min-w-[90px]">{time}</span>
      <span className="hidden sm:inline">·</span>
      <span className="hidden sm:inline">{date}</span>
      <span className="hidden sm:inline text-xs ml-1 text-primary/70 font-semibold">(PHT)</span>
    </div>
  );
}
