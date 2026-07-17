"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { JournalEntryEditor } from "@/components/ledger/journal-entry-editor";
import type { JournalEntryWithLines } from "@/types/database";

export default function EditJournalEntryPage() {
  const { id } = useParams<{ id: string }>();
  const [entry, setEntry] = useState<JournalEntryWithLines | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/gl/journal-entries/${id}`);
      if (res.ok) setEntry(await res.json());
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <AppShell><p className="text-sm text-muted-foreground">Loading…</p></AppShell>;
  if (!entry) return <AppShell><p className="text-sm text-muted-foreground">Entry not found.</p></AppShell>;

  return (
    <AppShell>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Edit journal entry</h1>
        <JournalEntryEditor entry={entry} />
      </div>
    </AppShell>
  );
}
