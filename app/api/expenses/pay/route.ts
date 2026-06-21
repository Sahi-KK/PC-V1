import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { split_id } = body

  if (!split_id) {
    return NextResponse.json({ error: 'Missing split_id' }, { status: 400 })
  }

  // To prevent anyone from marking a split as paid, the RLS policy "Creators can update splits" 
  // requires that the user updating the split is the one who paid for the expense.
  // We'll just execute the update, and if RLS blocks it, it will fail.
  
  const { error, data } = await supabase
    .from('expense_splits')
    .update({ is_paid: true, paid_at: new Date().toISOString() })
    .eq('id', split_id)
    .select()

  if (error || !data || data.length === 0) {
    return NextResponse.json({ error: 'Failed to update or unauthorized (only the creator can mark as paid)' }, { status: 403 })
  }

  return NextResponse.json({ success: true })
}
