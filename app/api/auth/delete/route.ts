import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as supabaseCreateClient } from '@supabase/supabase-js'

function getAdminClient() {
  return supabaseCreateClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
    }

    const adminClient = getAdminClient()

    // Delete user profiles and auth data. 
    await adminClient.from('user_profiles').delete().eq('id', user.id)

    // Hard delete user via admin auth api
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id)

    if (deleteError) {
      console.error('Delete account error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete account.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err) {
    console.error('Delete account exception:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
