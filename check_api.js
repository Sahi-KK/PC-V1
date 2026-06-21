require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  const { data, error } = await supabase
    .from('expenses')
    .select(`
      id, description, total_amount, date, paid_by, created_at,
      expense_splits ( id, user_id, amount_owed, is_paid, paid_at ),
      user_profiles:paid_by ( name )
    `)
  console.log('Error:', error)
  console.log('Data:', data)
}
run()
