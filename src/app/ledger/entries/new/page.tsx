import { AppShell } from "@/components/layout/app-shell";
import { JournalEntryEditor } from "@/components/ledger/journal-entry-editor";

export default function NewJournalEntryPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">New journal entry</h1>
        <JournalEntryEditor />
      </div>
    </AppShell>
  );
}
