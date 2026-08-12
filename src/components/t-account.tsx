import { formatCurrency, formatDate } from "@/lib/utils/finance";

export type TAccountEntry = {
  id: string;
  date: string;
  description: string;
  amount: number;
};

type TAccountProps = {
  debitLabel: string;
  creditLabel: string;
  debits: TAccountEntry[];
  credits: TAccountEntry[];
  emptyDebitText?: string;
  emptyCreditText?: string;
};

function AccountSide({ label, entries, emptyText, tone }: { label: string; entries: TAccountEntry[]; emptyText: string; tone: "debit" | "credit" }) {
  const total = entries.reduce((sum, entry) => sum + Number(entry.amount), 0);
  return (
    <section className={`rounded-xl border p-3 ${tone === "debit" ? "border-emerald-200/70 bg-emerald-50/30" : "border-rose-200/70 bg-rose-50/30"}`}>
      <div className="flex items-center justify-between gap-3 border-b pb-2">
        <h4 className="text-sm font-semibold">{label}</h4>
        <strong className={tone === "debit" ? "text-emerald-700" : "text-rose-700"}>{formatCurrency(total)}</strong>
      </div>
      {entries.length ? <div className="divide-y">{entries.map((entry) => <div key={entry.id} className="py-2.5"><p className="truncate text-sm font-medium">{entry.description}</p><div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{formatDate(entry.date)}</span><span>{formatCurrency(Number(entry.amount))}</span></div></div>)}</div> : <p className="py-6 text-center text-xs text-muted-foreground">{emptyText}</p>}
    </section>
  );
}

export function TAccount({ debitLabel, creditLabel, debits, credits, emptyDebitText = "No debit entries yet.", emptyCreditText = "No credit entries yet." }: TAccountProps) {
  return <div className="grid gap-3 sm:grid-cols-2"><AccountSide label={debitLabel} entries={debits} emptyText={emptyDebitText} tone="debit" /><AccountSide label={creditLabel} entries={credits} emptyText={emptyCreditText} tone="credit" /></div>;
}
