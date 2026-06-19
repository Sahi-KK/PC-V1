import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// Fetch user's attendance records
export async function GET(request: Request) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: attendance, error } = await supabase
    .from('attendance')
    .select('calendar_entry_id, is_present')
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ attendance })
}

// Mark present or undo
export async function POST(request: Request) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { calendar_entry_id, action } = body

  if (!calendar_entry_id || !action) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
  }

  if (action === 'present') {
    const { error } = await supabase
      .from('attendance')
      .upsert({
        user_id: user.id,
        calendar_entry_id: calendar_entry_id,
        is_present: true
      }, { onConflict: 'user_id, calendar_entry_id' })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  } else if (action === 'undo') {
    const { error } = await supabase
      .from('attendance')
      .delete()
      .match({ user_id: user.id, calendar_entry_id: calendar_entry_id })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
