import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

webpush.setVapidDetails(
  'mailto:admin@iimr.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function triggerAllTest() {
  const { data: profiles, error } = await supabase.from('user_profiles').select('*').not('push_subscriptions', 'is', null)
  
  if (profiles && profiles.length > 0) {
    console.log(`Found ${profiles.length} profiles with Push Subscriptions. Sending test class notification to ALL.`)
    
    for (const profile of profiles) {
      if (!profile.push_subscriptions || profile.push_subscriptions.length === 0) continue;
      
      const title = `Upcoming Class: DEMO`
      const msg = `Starts in 5 minutes in LR 1 (This is a live test!)`
      const payload = JSON.stringify({ title, body: msg, url: '/dashboard/attendance' })
      
      console.log(`Sending to ${profile.email}...`)
      for (const sub of profile.push_subscriptions) {
        try {
          await webpush.sendNotification(sub, payload)
          console.log('SUCCESS for', profile.email)
        } catch (e) {
          console.error('Push Error for', profile.email, e.statusCode, e.body)
        }
      }
    }
    console.log("Done firing test notifications!")
  } else {
    console.log("No users with Web Push linked yet.")
  }
}
triggerAllTest()
