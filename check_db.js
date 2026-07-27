import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data, error } = await supabase
    .from('loans')
    .select('id, person_name, start_date, repayment_amount, total_amount, frequency, installments, remaining_balance')
    .eq('person_name', 'Nariciso - MB');

  if (error) console.error(error);
  console.dir(data, { depth: null });
}

main();
