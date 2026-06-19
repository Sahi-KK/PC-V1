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
    .select('name, roll_no')

  if (!allowedUsers || allowedUsers.length === 0) {
    return NextResponse.json({ spcs: [] })
  }

  const rollNos = allowedUsers.map(u => u.roll_no)

  // 2. Get their student IDs
  const { data: students } = await service
    .from('students')
    .select('id, roll_no')
    .in('roll_no', rollNos)

  if (!students || students.length === 0) {
    return NextResponse.json({ spcs: [] })
  }

  const studentIdToRollNo = new Map(students.map(s => [s.id, s.roll_no]))
  const studentIds = students.map(s => s.id)

  // 3. Get their enrollments
  const { data: enrollments } = await service
    .from('student_courses')
    .select('student_id, course_abbr, section')
    .in('student_id', studentIds)

  // 4. Get all calendar entries for that date (excluding holidays/exams)
  const { data: calendarEntries } = await service
    .from('calendar_entries')
    .select('time_slot, course_abbr, section')
    .eq('date', date)
    .eq('is_holiday', false)
    .eq('is_exam_period', false)

  // Pre-process calendar entries into a quick lookup Set: `course_abbr-section-time_slot`
  const entrySet = new Set(calendarEntries?.map(e => `${e.course_abbr}-${e.section}-${e.time_slot}`))

  // Calculate free slots for each SPC
  const spcs = allowedUsers.map(user => {
    // Find student id
    const student = students.find(s => s.roll_no === user.roll_no)
    const sId = student?.id

    const myEnrollments = enrollments?.filter(e => e.student_id === sId) || []

    // For each time slot, check if they have a class
    const freeSlots = TIME_ORDER.filter(slot => {
      // Is there any enrollment that has a calendar entry at this slot?
      const hasClass = myEnrollments.some(enr => entrySet.has(`${enr.course_abbr}-${enr.section}-${slot}`))
      return !hasClass
    })

    return {
      roll_no: user.roll_no,
      name: user.name,
      freeSlots
    }
  })

  // Sort alphabetically by name
  spcs.sort((a, b) => a.name.localeCompare(b.name))

  return NextResponse.json({ spcs })
}
