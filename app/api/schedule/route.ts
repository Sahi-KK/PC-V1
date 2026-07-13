import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as supabaseCreateClient } from '@supabase/supabase-js'

function getService() {
  return supabaseCreateClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

let cachedCourseMap: Record<string, { full_name: string; faculty: string; faculty_abbr: string }> | null = null;
let lastCacheTime = 0;
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

async function getCourseMap(service: any) {
  if (cachedCourseMap && Date.now() - lastCacheTime < CACHE_TTL) {
    return cachedCourseMap;
  }
  const { data: courses } = await service
    .from('courses')
    .select('abbr, full_name, faculty, faculty_abbr, credit')
  
  const courseMap: Record<string, { full_name: string; faculty: string; faculty_abbr: string }> = {}
  courses?.forEach((c: any) => { courseMap[c.abbr] = c })
  
  cachedCourseMap = courseMap;
  lastCacheTime = Date.now();
  return courseMap;
}

// GET /api/schedule
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = getService()

  // Phase 1: Fetch Profile and CourseMap in parallel
  const [courseMap, { data: prof }] = await Promise.all([
    getCourseMap(service),
    service.from('user_profiles').select('name, roll_no, email').eq('id', user.id).single()
  ])

  if (!prof || !prof.roll_no) {
    return NextResponse.json({ profile: prof, student: null, entries: [], enrollments: [], attendance: [] })
  }

  // Phase 2: Fetch Student and Attendance in parallel
  const [{ data: student }, { data: attendance }] = await Promise.all([
    service.from('students').select('id, name, roll_no').eq('roll_no', prof.roll_no).single(),
    supabase.from('attendance').select('calendar_entry_id, is_present').eq('user_id', user.id)
  ])

  if (!student) {
    return NextResponse.json({ profile: prof, student: null, entries: [], enrollments: [], attendance: attendance || [] })
  }

  // Phase 3: Fetch Enrollments
  const { data: enrollments } = await service
    .from('student_courses')
    .select('course_abbr, section')
    .eq('student_id', student.id)

  if (!enrollments || enrollments.length === 0) {
    return NextResponse.json({ profile: prof, student, entries: [], enrollments: [], attendance: attendance || [] })
  }

  // Phase 4: Fetch Calendar Entries matching enrollments
  const orFilters = enrollments.map(
    ({ course_abbr, section }) => `and(course_abbr.eq.${course_abbr},section.eq.${section})`
  ).join(',')

  const { data: entries, error: calErr } = await service
    .from('calendar_entries')
    .select('*')
    .or(orFilters)
    .order('date', { ascending: true })
    .order('time_slot', { ascending: true })

  if (calErr) {
    return NextResponse.json({ error: calErr.message }, { status: 500 })
  }

  // Enrich entries with course info
  const enrichedEntries = entries?.map(e => ({
    ...e,
    course_full_name: courseMap[e.course_abbr]?.full_name || e.course_abbr,
    faculty: courseMap[e.course_abbr]?.faculty || '',
    faculty_abbr: courseMap[e.course_abbr]?.faculty_abbr || '',
  })) || []

  return NextResponse.json({
    profile: prof,
    student,
    entries: enrichedEntries,
    enrollments,
    attendance: attendance || []
  })
}
