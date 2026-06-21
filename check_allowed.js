require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  const { data: allowed } = await supabase.from('allowed_users').select('*')
  console.log('Allowed Users:', allowed)
  
  const { data: users } = await supabase.auth.admin.listUsers()
  console.log('\nAuth Users:', users.users.map(u => ({ id: u.id, email: u.email })))
  
  const { data: profiles } = await supabase.from('user_profiles').select('*')
  console.log('\nUser Profiles:', profiles)
}

run()
