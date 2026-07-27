import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error("No SUPABASE_SERVICE_ROLE_KEY found in .env.local!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Fetching all transactions with loan_id...");
  const { data: txs, error: txError } = await supabase
    .from('transactions')
    .select('id, loan_id, description')
    .not('loan_id', 'is', null);

  if (txError) throw txError;
  console.log(`Found ${txs.length} transactions with loan_id.`);

  const { data: loans, error: loanError } = await supabase
    .from('loans')
    .select('id');

  if (loanError) throw loanError;
  
  const validLoanIds = new Set(loans.map(l => l.id));

  const orphaned = txs.filter(tx => !validLoanIds.has(tx.loan_id));
  console.log(`Found ${orphaned.length} orphaned transactions.`);

  if (orphaned.length > 0) {
    const orphanedIds = orphaned.map(t => t.id);
    console.log("Deleting orphaned transactions...", orphanedIds);
    const { error: delError } = await supabase
      .from('transactions')
      .delete()
      .in('id', orphanedIds);
      
    if (delError) throw delError;
    console.log("Successfully deleted orphaned transactions.");
  } else {
    console.log("No orphaned transactions to delete.");
  }
}

main().catch(console.error);
