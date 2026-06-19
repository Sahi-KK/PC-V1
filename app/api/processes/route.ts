import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as supabaseCreateClient } from '@supabase/supabase-js'

function getService() {
  return supabaseCreateClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = getService()

  // Get all processes ordered by date and time
  const { data: processes, error } = await service
    .from('processes')
    .select(`
      id, name, date, time_slot, created_at, created_by,
      process_spcs ( spc_roll_no )
    `)
    .order('date', { ascending: true })
    .order('time_slot', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Get names of SPCs
  const { data: allowedUsers } = await service.from('allowed_users').select('roll_no, name')
  const nameMap = new Map(allowedUsers?.map(u => [u.roll_no, u.name]) || [])

  const enriched = processes.map(p => ({
    id: p.id,
    name: p.name,
    date: p.date,
    time_slot: p.time_slot,
    created_at: p.created_at,
    created_by: p.created_by,
    spcs: p.process_spcs.map((ps: any) => ({
      roll_no: ps.spc_roll_no,
      name: nameMap.get(ps.spc_roll_no) || ps.spc_roll_no
    }))
  }))

  return NextResponse.json({ processes: enriched })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { name, date, time_slot, spc_roll_nos } = await req.json()
    if (!name || !date || !time_slot || !Array.isArray(spc_roll_nos)) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const service = getService()

    // 1. Insert process
    const { data: proc, error: pErr } = await service
      .from('processes')
      .insert({ name, date, time_slot, created_by: user.id })
      .select('id')
      .single()

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

    // 2. Insert SPCs
    if (spc_roll_nos.length > 0) {
      const spcInserts = spc_roll_nos.map(roll_no => ({
        process_id: proc.id,
        spc_roll_no: roll_no
      }))
      
      const { error: sErr } = await service.from('process_spcs').insert(spcInserts)
      if (sErr) {
        // Rollback
        await service.from('processes').delete().eq('id', proc.id)
        return NextResponse.json({ error: sErr.message }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true, process_id: proc.id })

  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
