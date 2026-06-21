require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  const { data: expenses } = await supabase.from('expenses').select('*')
  console.log('Expenses:', expenses)

  const { data: splits } = await supabase.from('expense_splits').select('*')
  console.log('Splits:', splits)
}
run()
