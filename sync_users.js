require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  const { data: allowed } = await supabase.from('allowed_users').select('*')
  const { data: authUsersRes } = await supabase.auth.admin.listUsers()
  const authUsers = authUsersRes.users

  for (const user of allowed) {
    const exists = authUsers.find(u => u.email === user.email)
    if (!exists) {
      console.log('Creating auth user for:', user.email)
      const { data: newAuth, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: 'Password@123',
        email_confirm: true
      })
      if (authError) {
        console.error('Auth error:', authError)
        continue
      }
      
      const { error: profileError } = await supabase.from('user_profiles').insert({
        id: newAuth.user.id,
        name: user.name,
        roll_no: user.roll_no,
        email: user.email
      })
      if (profileError) {
        console.error('Profile error:', profileError)
      } else {
        console.log('Created profile for:', user.email)
      }
    }
  }
  console.log('Sync complete!')
}

run()
