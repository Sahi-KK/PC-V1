import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkUsers() {
  const { data, error } = await supabase.from('user_profiles').select('email, name')
  if (error) {
    console.error(error)
  } else {
    console.log(`Found ${data.length} users:`)
    data.forEach(u => console.log(`- ${u.name} (${u.email})`))
  }
}

checkUsers()
