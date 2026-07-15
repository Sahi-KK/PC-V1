import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function triggerTest() {
  const { data: profiles, error } = await supabase.from('user_profiles').select('*').not('push_subscriptions', 'is', null)
  
  if (profiles && profiles.length > 0) {
    console.log("Found profile with Push Subscriptions:", profiles[0].email)
    
    // Get current time + 5 mins
    const nowStr = new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})
    const now = new Date(nowStr)
    const later = new Date(now.getTime() + 5 * 60000)
    
    const todayYYYYMMDD = later.getFullYear() + '-' + String(later.getMonth() + 1).padStart(2, '0') + '-' + String(later.getDate()).padStart(2, '0')
    const timeStr = String(later.getHours()).padStart(2, '0') + ':' + String(later.getMinutes()).padStart(2, '0')
    
    // Insert dummy Todo
    const { data: todo, error: todoErr } = await supabase.from('todos').insert({
      user_id: profiles[0].id,
      title: "🔥 LIVE TEST FIRE 🔥",
      description: "If you are reading this, the Native Phone Push works perfectly!",
      event_date: todayYYYYMMDD,
      start_time: timeStr
    }).select()
    
    console.log("Inserted Todo:", todoErr || todo)
  } else {
    console.log("No users with Web Push linked yet.")
  }
}
triggerTest()
