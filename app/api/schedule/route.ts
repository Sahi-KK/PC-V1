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

// GET /api/schedule?roll_no=IPM04134
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const roll_no = req.nextUrl.searchParams.get('roll_no')
  if (!roll_no) return NextResponse.json({ error: 'roll_no required' }, { status: 400 })

  const service = getService()

  // Start course map fetch concurrently
  const courseMapPromise = getCourseMap(service)

  // Get student
  const { data: student, error: sErr } = await service
    .from('students')
    .select('id, name, roll_no')
    .eq('roll_no', roll_no)
    .single()

  if (sErr || !student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 })
  }

  // Get student's course enrollments
  const { data: enrollments } = await service
    .from('student_courses')
    .select('course_abbr, section')
    .eq('student_id', student.id)

  if (!enrollments || enrollments.length === 0) {
    return NextResponse.json({ student, entries: [], dateMetaMap: {}, enrollments: [] })
  }

  // Filter out CW-
  const courseAbbrSectionPairs = enrollments.filter(e => e.course_abbr !== 'CW-')

  if (courseAbbrSectionPairs.length === 0) {
    return NextResponse.json({ student, entries: [], dateMetaMap: {}, enrollments: [] })
  }

  // Get all calendar entries for these courses/sections
  const orFilters = courseAbbrSectionPairs.map(
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

  // Await the concurrently fetched course map
  const courseMap = await courseMapPromise

  // Enrich entries with course info
  const enrichedEntries = entries?.map(e => ({
    ...e,
    course_full_name: courseMap[e.course_abbr]?.full_name || e.course_abbr,
    faculty: courseMap[e.course_abbr]?.faculty || '',
    faculty_abbr: courseMap[e.course_abbr]?.faculty_abbr || '',
  })) || []

  return NextResponse.json({
    student,
    entries: enrichedEntries,
    enrollments: courseAbbrSectionPairs,
  })
}
