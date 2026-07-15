import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const crypto = require('crypto')
  const token = crypto.randomUUID()
  
  // Store token in profile (make sure telegram_link_token exists in DB schema)
  const { error } = await supabase
    .from('user_profiles')
    .update({ telegram_link_token: token })
    .eq('id', user.id)
    
  if (error) {
    console.error('Error generating token:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
  
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'Secret_Best_13_bot'
  const link = `https://t.me/${botUsername}?start=${token}`
  
  return NextResponse.json({ link })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('telegram_chat_id')
    .eq('id', user.id)
    .single()
    
  return NextResponse.json({ isLinked: !!profile?.telegram_chat_id })
}
