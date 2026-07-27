require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  // Get all active loans
  const { data: loans } = await sb.from('loans').select('id');
  const loanIds = new Set(loans.map(l => l.id));
  
  // Get all active collections
  const { data: collections } = await sb.from('loan_collections').select('id');
  const colIds = new Set(collections.map(c => c.id));
  
  // Get all journal entries with reference starting with 'loan_' or 'col_'
  const { data: entries } = await sb.from('journal_entries').select('id, reference').or('reference.ilike.loan_%,reference.ilike.col_%');
  
  let deletedCount = 0;
  for (const entry of entries) {
    if (entry.reference.startsWith('loan_')) {
      const id = entry.reference.replace('loan_', '');
      if (!loanIds.has(id)) {
        await sb.from('journal_entries').delete().eq('id', entry.id);
        deletedCount++;
      }
    } else if (entry.reference.startsWith('col_')) {
      const id = entry.reference.replace('col_', '');
      if (!colIds.has(id)) {
        await sb.from('journal_entries').delete().eq('id', entry.id);
        deletedCount++;
      }
    }
  }
  console.log(`Deleted ${deletedCount} orphaned journal entries.`);
}
run().catch(console.error);
