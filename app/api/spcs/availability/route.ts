import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as supabaseCreateClient } from '@supabase/supabase-js'

function getService() {
  return supabaseCreateClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const TIME_ORDER = [
  '08:45-10:00','10:20-11:35','11:55-1:10',
  '14:30-15:45','16:05-17:20','17:40-18:55',
  '19:15-20:30','20:50-22:05','22:25-23:40'
]

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const date = req.nextUrl.searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  const service = getService()

  // 1. Get the 13 allowed users
  const { data: allowedUsers } = await service
    .from('allowed_users')
    .select('name, roll_no, email')

  if (!allowedUsers || allowedUsers.length === 0) {
    return NextResponse.json({ spcs: [] })
  }

  const rollNos = allowedUsers.map(u => u.roll_no)

  // 2. Get their student IDs
  const { data: students } = await service
    .from('students')
    .select('id, roll_no')
    .in('roll_no', rollNos)

  // 3. Get their enrollments
  let enrollments: any[] = []
  if (students && students.length > 0) {
    const studentIds = students.map(s => s.id)
    const { data: scData } = await service
      .from('student_courses')
      .select('student_id, course_abbr, section')
      .in('student_id', studentIds)
    enrollments = scData || []
  }

  // 4. Get all calendar entries for the date
  const { data: dayEntries } = await service
    .from('calendar_entries')
    .select('course_abbr, section, time_slot')
    .eq('date', date)

  const entriesList = dayEntries || []

  const spcs = allowedUsers.map(u => {
    // Find student
    const st = students?.find(s => s.roll_no === u.roll_no)
    let busySlots: string[] = []
    
    if (st) {
      // Find their enrollments
      const stEnrollments = enrollments.filter(e => e.student_id === st.id)
      
      // Find matching entries for today
      const stEntries = entriesList.filter(entry => 
        stEnrollments.some(e => e.course_abbr === entry.course_abbr && e.section === entry.section)
      )
      
      busySlots = stEntries.map(e => e.time_slot)
    }

    const freeSlots = TIME_ORDER.filter(slot => !busySlots.includes(slot))

    return {
      roll_no: u.roll_no,
      name: u.name,
      email: u.email,
      freeSlots
    }
  })

  // Sort alphabetically by name
  spcs.sort((a, b) => a.name.localeCompare(b.name))

  return NextResponse.json({ spcs })
}
