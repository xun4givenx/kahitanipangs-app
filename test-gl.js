require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data } = await sb.from('ledger_accounts').select('*').ilike('name', '%Cash on Collected%');
  console.log(data);
  const { data: tb } = await sb.rpc('get_trial_balance', {}); // wait, I don't have this rpc
}
run();
