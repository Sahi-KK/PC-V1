import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    // Telegram sends messages here
    if (body.message && body.message.text) {
      const chatId = body.message.chat.id
      const text = body.message.text.trim()
      
      // If user clicks /start with a token: e.g., /start d4b3...
      if (text.startsWith('/start ')) {
        const token = text.split(' ')[1]
        
        if (token) {
          const supabase = await createClient()
          
          // Find the user with this token
          const { data: profile, error } = await supabase
            .from('user_profiles')
            .select('id, name')
            .eq('telegram_link_token', token)
            .single()
            
          if (profile) {
            // Update profile with the chat ID
            await supabase
              .from('user_profiles')
              .update({ telegram_chat_id: chatId.toString() })
              .eq('id', profile.id)
              
            // Send success message
            await fetch(`${TELEGRAM_API}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: `✅ Welcome ${profile.name}! Your account has been successfully linked to the IIMR Academic Calendar.\n\nYou will now receive important notifications and alerts here.`,
                parse_mode: 'HTML'
              })
            })
          } else {
            // Token invalid or expired
            await fetch(`${TELEGRAM_API}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: `❌ Invalid or expired connection token. Please try linking again from the Profile page.`
              })
            })
          }
        }
      } else if (text === '/start') {
        await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `Welcome to the IIMR Academic Bot!\nTo link your account, please click the 'Link Telegram' button in the Profile tab of your app.`
          })
        })
      }
    }
    
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Telegram webhook error:', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
