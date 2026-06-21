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

  const { data: allowedUsers } = await service.from('allowed_users').select('roll_no, name')
  const nameMap = new Map(allowedUsers?.map(u => [u.roll_no, u.name]) || [])

  const { data: profiles } = await service.from('user_profiles').select('id, name')
  const creatorMap = new Map(profiles?.map(p => [p.id, p.name]) || [])

  const enriched = processes.map(p => ({
    id: p.id,
    name: p.name,
    date: p.date,
    time_slot: p.time_slot,
    created_at: p.created_at,
    created_by: p.created_by,
    creator_name: creatorMap.get(p.created_by) || 'Unknown',
    spcs: p.process_spcs.map((ps: any) => ({
      roll_no: ps.spc_roll_no,
      name: nameMap.get(ps.spc_roll_no) || ps.spc_roll_no
    }))
  }))

  return NextResponse.json({ processes: enriched, current_user_id: user.id })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { name, date, slots } = await req.json()
    if (!name || !date || !Array.isArray(slots) || slots.length === 0) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const service = getService()

    const processInserts = slots.map(s => ({
      name, date, time_slot: s.time_slot, created_by: user.id
    }))

    const { data: procs, error: pErr } = await service
      .from('processes')
      .insert(processInserts)
      .select('id, time_slot')

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

    const spcInserts: { process_id: string, spc_roll_no: string }[] = []
    for (const p of procs) {
      const slotConfig = slots.find((s: any) => s.time_slot === p.time_slot)
      if (slotConfig && Array.isArray(slotConfig.spc_roll_nos)) {
        for (const roll of slotConfig.spc_roll_nos) {
          spcInserts.push({ process_id: p.id, spc_roll_no: roll })
        }
      }
    }

    if (spcInserts.length > 0) {
      const { error: sErr } = await service.from('process_spcs').insert(spcInserts)
      if (sErr) {
        return NextResponse.json({ error: sErr.message }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const process_id = req.nextUrl.searchParams.get('id')
  if (!process_id) return NextResponse.json({ error: 'Missing process ID' }, { status: 400 })

  const service = getService()

  const { data: proc, error: pErr } = await service.from('processes').select('created_by').eq('id', process_id).single()
  if (pErr || !proc) return NextResponse.json({ error: 'Process not found' }, { status: 404 })
  
  if (proc.created_by !== user.id) {
    return NextResponse.json({ error: 'Only the creator can delete this process' }, { status: 403 })
  }

  const { error: dErr } = await service.from('processes').delete().eq('id', process_id)
  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
