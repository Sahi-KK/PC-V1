import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch all expenses created by the user, OR where the user is a debtor
  // Since we want details, we do a join.
  
  const { data: expenses, error } = await supabase
    .from('expenses')
    .select(`
      id, description, total_amount, date, paid_by, created_at,
      expense_splits ( id, user_id, amount_owed, is_paid, paid_at )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fetch profiles to map the 'paid_by' user name
  const { data: profiles } = await supabase.from('user_profiles').select('id, name')
  const profileMap = new Map((profiles || []).map(p => [p.id, p.name]))

  const expensesWithProfiles = (expenses || []).map(exp => ({
    ...exp,
    user_profiles: { name: profileMap.get(exp.paid_by) || 'Unknown' }
  }))

  // Filter to only expenses where the user is involved (paid_by OR in expense_splits)
  const myExpenses = expensesWithProfiles.filter(e => {
    if (e.paid_by === user.id) return true;
    return e.expense_splits.some((split: any) => split.user_id === user.id);
  })

  return NextResponse.json({ expenses: myExpenses })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { description, total_amount, date, splits } = body
  // splits = [{ user_id, amount_owed }]

  if (!description || !total_amount || !splits || splits.length === 0) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // 1. Insert expense
  const { data: expense, error: expError } = await supabase
    .from('expenses')
    .insert({
      description,
      total_amount,
      paid_by: user.id,
      date: date || new Date().toISOString().split('T')[0]
    })
    .select()
    .single()

  if (expError || !expense) {
    return NextResponse.json({ error: expError?.message || 'Failed to create expense' }, { status: 500 })
  }

  // 2. Insert splits
  const splitInserts = splits.map((s: any) => ({
    expense_id: expense.id,
    user_id: s.user_id,
    amount_owed: s.amount_owed,
    is_paid: s.user_id === user.id // if I am in the split, I already paid myself
  }))

  const { error: splitError } = await supabase
    .from('expense_splits')
    .insert(splitInserts)

  if (splitError) {
    // Ideally rollback, but Supabase JS doesn't support transactions over REST easily
    return NextResponse.json({ error: splitError.message }, { status: 500 })
  }

  // 3. Create In-App Notifications and send Push Notifications
  try {
    const debtorIds = splits.filter((s: any) => s.user_id !== user.id).map((s: any) => s.user_id)
    if (debtorIds.length > 0) {
      // Get the creator's profile to say "You owe X for Y to [Name]"
      const { data: creator } = await supabase.from('user_profiles').select('name').eq('id', user.id).single()
      const creatorName = creator?.name || 'Someone'

      const notificationsToInsert = splits
        .filter((s: any) => s.user_id !== user.id)
        .map((s: any) => ({
          user_id: s.user_id,
          title: 'New Shared Expense',
          message: `You owe ₹${s.amount_owed} for "${description}" to ${creatorName}.`,
          action_url: '/dashboard/expenses'
        }))

      await supabase.from('notifications').insert(notificationsToInsert)

      // Get debtor profiles for push subscriptions
      const { data: debtorProfiles } = await supabase
        .from('user_profiles')
        .select('id, push_subscriptions')
        .in('id', debtorIds)

      const webpush = require('web-push')
      webpush.setVapidDetails(
        'mailto:support@iimrohtak.ac.in', // arbitrary
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
        process.env.VAPID_PRIVATE_KEY!
      )

      debtorProfiles?.forEach(profile => {
        const subs = profile.push_subscriptions || []
        const userSplit = splits.find((s: any) => s.user_id === profile.id)
        const payload = JSON.stringify({
          title: 'New Expense Split',
          body: `You owe ₹${userSplit?.amount_owed} for "${description}".`
        })

        subs.forEach((sub: any) => {
          webpush.sendNotification(sub, payload).catch((e: any) => console.error('Push Error', e))
        })
      })
    }
  } catch (e) {
    console.error('Failed to send notifications', e)
  }

  return NextResponse.json({ success: true, expense })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id } = body

  if (!id) return NextResponse.json({ error: 'Missing expense ID' }, { status: 400 })

  // Ensure only the creator can delete it
  const { data: exp } = await supabase.from('expenses').select('paid_by').eq('id', id).single()
  if (!exp || exp.paid_by !== user.id) {
    return NextResponse.json({ error: 'Unauthorized to delete this expense' }, { status: 403 })
  }

  const serviceClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await serviceClient.from('expenses').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
