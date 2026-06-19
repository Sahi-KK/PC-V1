import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as supabaseCreateClient } from '@supabase/supabase-js'

function getService() {
  return supabaseCreateClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/students?q=Krishna
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q') || ''

  if (q.length < 2 && q !== 'all') {
    return NextResponse.json({ students: [] })
  }

  const service = getService()

  let queryBuilder = service.from('students').select('id, roll_no, name').order('name')
  
  if (q !== 'all') {
    queryBuilder = queryBuilder.or(`name.ilike.%${q}%,roll_no.ilike.%${q}%`).limit(20)
  }

  const { data: students, error } = await queryBuilder

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ students: students || [] })
}
