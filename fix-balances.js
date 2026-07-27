require('dotenv').config({ path: '.env.local' });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1';
const headers = {
  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json'
};

async function run() {
  const loansRes = await fetch(`${url}/loans?select=*`, { headers });
  const loans = await loansRes.json();
  let fixedCount = 0;
  
  for (const loan of loans) {
    const colsRes = await fetch(`${url}/loan_collections?loan_id=eq.${loan.id}&select=*`, { headers });
    const collections = await colsRes.json();
    
    let expectedRemaining = loan.advanced_interest 
      ? Number(loan.total_amount)
      : Number(loan.total_amount) + (Number(loan.total_amount) * Number(loan.interest_rate) / 100);
      
    let totalInstallmentsCollected = 0;
    let expectedSavings = 0;
    
    for (const col of collections) {
      if (col.kind === 'collection') {
        totalInstallmentsCollected += Number(col.installment_amount);
        expectedSavings += Number(col.savings_delta);
      } else if (col.kind === 'withdrawal') {
        expectedSavings += Number(col.savings_delta); // negative
      }
    }
    
    expectedRemaining = Math.max(0, expectedRemaining - totalInstallmentsCollected);
    expectedSavings = Math.max(0, expectedSavings);
    
    if (Math.abs(expectedRemaining - Number(loan.remaining_balance)) > 0.01 || Math.abs(expectedSavings - Number(loan.savings_balance)) > 0.01) {
      console.log(`Fixing loan ${loan.person_name} (ID: ${loan.id}):`);
      console.log(`  Remaining Balance: ${loan.remaining_balance} -> ${expectedRemaining.toFixed(2)}`);
      console.log(`  Savings Balance: ${loan.savings_balance} -> ${expectedSavings.toFixed(2)}`);
      
      await fetch(`${url}/loans?id=eq.${loan.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          remaining_balance: Number(expectedRemaining.toFixed(2)),
          savings_balance: Number(expectedSavings.toFixed(2))
        })
      });
      
      fixedCount++;
    }
  }
  
  console.log(`Fixed ${fixedCount} corrupted loans.`);
}
run().catch(console.error);
