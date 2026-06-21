import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

  // Find unpaid splits
  const { data: unpaidSplits, error } = await supabase
    .from('expense_splits')
    .select(`
      id, amount_owed, user_id, 
      expenses ( description, paid_by )
    `)
    .eq('is_paid', false)

  if (error || !unpaidSplits) {
    return NextResponse.json({ error: 'Failed to fetch unpaid splits' }, { status: 500 })
  }

  // We need to fetch push_subscriptions for the users who owe money
  const debtorIds = Array.from(new Set(unpaidSplits.map(s => s.user_id)))
  
  if (debtorIds.length === 0) {
    return NextResponse.json({ message: 'No unpaid expenses.' })
  }

  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, push_subscriptions')
    .in('id', debtorIds)

  let notificationsSent = 0

  // Simulate pushing web-push notifications to these subscriptions
  // In a real implementation we would use `web-push` library.
  // We will hit the WhatsApp companion server API for each debtor here as well.
  
  const companionServerUrl = process.env.WHATSAPP_COMPANION_URL
  const webpush = require('web-push')
  if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      'mailto:support@iimrohtak.ac.in',
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    )
  }

  for (const split of unpaidSplits) {
    const profile = profiles?.find(p => p.id === split.user_id)
    if (profile) {
      const messageText = `Reminder: You owe ₹${split.amount_owed} for "${(split.expenses as any)?.description}". Please settle up!`
      
      // WhatsApp Send
      if (companionServerUrl) {
        try {
          await fetch(`${companionServerUrl}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: split.user_id, message: messageText })
          })
          notificationsSent++
        } catch (e) {
          console.error('Failed to notify WhatsApp', e)
        }
      }

      // Web Push Send
      const subs = profile.push_subscriptions || []
      if (subs.length > 0 && process.env.VAPID_PRIVATE_KEY) {
        const payload = JSON.stringify({
          title: 'Unpaid Expense Reminder',
          body: messageText
        })
        subs.forEach((sub: any) => {
          webpush.sendNotification(sub, payload).catch((e: any) => console.error('Push Error in Cron', e))
        })
      }
    }
  }

  return NextResponse.json({ success: true, notificationsSent })
}
