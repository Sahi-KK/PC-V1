import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import webpush from 'web-push'

// Configure Web Push
webpush.setVapidDetails(
  'mailto:admin@iimr.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
)

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

async function sendTelegramMessage(chatId: string, text: string) {
  if (!chatId || !TELEGRAM_BOT_TOKEN) return false
  try {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    })
    return res.ok
  } catch (e) {
    console.error('Telegram Error:', e)
    return false
  }
}

async function sendWebPush(subscriptions: any[], payload: string) {
  if (!subscriptions || subscriptions.length === 0) return
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(sub, payload)
    } catch (e: any) {
      if (e.statusCode === 410 || e.statusCode === 404) {
        // Subscription is expired/invalid, should ideally remove from DB
        console.warn('Push subscription expired')
      } else {
        console.error('Web Push Error:', e)
      }
    }
  }
}

export async function GET(req: NextRequest) {
  // CRON endpoint: verify secure secret if passing one, skipping for demo
  const supabase = await createClient()

  // 1. Get current time in IST
  const nowStr = new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})
  const now = new Date(nowStr)
  
  // Lookahead window: 35 minutes
  const lookahead = new Date(now.getTime() + 35 * 60000)
  
  const todayYYYYMMDD = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0')
  const nowMins = now.getHours() * 60 + now.getMinutes()
  
  // We want events starting between nowMins and (nowMins + 35)

  // -----------------------------------------------------
  // A. SCAN TODOS
  // -----------------------------------------------------
  const { data: todos } = await supabase
    .from('todos')
    .select('*, user_profiles!todos_user_id_fkey(id, telegram_chat_id, push_subscriptions)')
    .eq('event_date', todayYYYYMMDD)

  let processedCount = 0

  if (todos) {
    for (const t of todos) {
      if (!t.start_time || !t.user_profiles) continue
      
      const [h, m] = t.start_time.split(':').map(Number)
      const eventMins = h * 60 + m
      
      // If event is starting in the next 0-35 mins
      if (eventMins >= nowMins && eventMins <= nowMins + 35) {
        const title = `Reminder: ${t.title}`
        const msg = `Starts at ${t.start_time}. ${t.description || ''}`
        
        // Check if notification already sent for this specific Todo today
        const actionUrl = `/dashboard/process#todo-${t.id}`
        const { data: existing } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', t.user_profiles.id)
          .eq('action_url', actionUrl)
          
        if (!existing || existing.length === 0) {
          // Send Notifications
          const payload = JSON.stringify({ title, body: msg, url: '/dashboard/process' })
          await sendWebPush(t.user_profiles.push_subscriptions, payload)
          await sendTelegramMessage(t.user_profiles.telegram_chat_id, `🔔 <b>${title}</b>\n${msg}`)
          
          // Log it so we never send it again
          await supabase.from('notifications').insert({
            user_id: t.user_profiles.id,
            title,
            message: msg,
            action_url: actionUrl
          })
          processedCount++
        }
      }
    }
  }
  
  // -----------------------------------------------------
  // B. SCAN CLASSES (calendar_entries)
  // -----------------------------------------------------
  // To avoid complexity, we can do a similar scan for classes by joining students -> sections
  // But for this phase, let's just make sure Todos work flawlessly and return
  
  return NextResponse.json({ ok: true, processed: processedCount })
}
