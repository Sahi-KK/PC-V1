require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  const { data, error } = await supabase.rpc('get_policies') // if exists, but probably doesn't
  if (error) {
    // try to just select using anon key to see if it's restricted
    const anonSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
    const { data: anonData, error: anonError } = await anonSupabase.from('user_profiles').select('*')
    console.log('Anon Data length:', anonData?.length, anonError)
  }
}
run()
