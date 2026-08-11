"use client";

import { QuickRecordDialog } from "@/components/quick-record-dialog";

export function CashRecordActions({ onSuccess }: { onSuccess?: () => void }) {
  return <><QuickRecordDialog type="expense" onSuccess={onSuccess} /><QuickRecordDialog type="income" onSuccess={onSuccess} /></>;
}
