import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase-server'

function getService() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const { email, name } = await req.json()

    // Get the authenticated user from server session
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
    }

    const serviceClient = getService()

    // Look up roll_no from whitelist
    const { data: allowedUser } = await serviceClient
      .from('allowed_users')
      .select('roll_no, name')
      .eq('email', email.trim().toLowerCase())
      .single()

    if (!allowedUser) {
      return NextResponse.json({ error: 'User not found in whitelist.' }, { status: 404 })
    }

    // Upsert user_profiles
    const { error: profileError } = await serviceClient
      .from('user_profiles')
      .upsert({
        id: user.id,
        roll_no: allowedUser.roll_no,
        name: allowedUser.name,
        email: email.trim().toLowerCase(),
      }, { onConflict: 'id' })

    if (profileError) {
      console.error('Profile creation error:', profileError)
      return NextResponse.json({ error: 'Failed to create profile.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err) {
    console.error('Create profile error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
