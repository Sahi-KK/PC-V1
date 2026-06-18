import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getService() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const { email, name } = await req.json()

    if (!email || !name) {
      return NextResponse.json({ error: 'Email and name are required.' }, { status: 400 })
    }

    // Check against whitelist
    const serviceClient = getService()
    const { data, error } = await serviceClient
      .from('allowed_users')
      .select('email, name, roll_no')
      .eq('email', email.trim().toLowerCase())
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: 'This email is not authorized to register. Please contact the administrator.' },
        { status: 403 }
      )
    }

    // Also check name matches (case-insensitive)
    const nameMatch = data.name.toLowerCase().trim() === name.toLowerCase().trim()
    if (!nameMatch) {
      return NextResponse.json(
        { error: 'The name you entered does not match our records. Please use your full name as registered.' },
        { status: 403 }
      )
    }

    return NextResponse.json({ ok: true, roll_no: data.roll_no }, { status: 200 })
  } catch (err) {
    console.error('Whitelist check error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
