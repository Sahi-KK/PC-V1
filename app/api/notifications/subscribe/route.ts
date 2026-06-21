import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { subscription } = body

  if (!subscription) {
    return NextResponse.json({ error: 'Missing subscription' }, { status: 400 })
  }

  // Fetch current profile
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('push_subscriptions')
    .eq('id', user.id)
    .single()

  let subs = profile?.push_subscriptions || []
  if (!Array.isArray(subs)) subs = []

  // Check if it already exists
  const exists = subs.find((s: any) => s.endpoint === subscription.endpoint)
  if (!exists) {
    subs.push(subscription)
    await supabase
      .from('user_profiles')
      .update({ push_subscriptions: subs })
      .eq('id', user.id)
  }

  return NextResponse.json({ success: true })
}
