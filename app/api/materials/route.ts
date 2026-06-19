import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') || ''
  const courseAbbr = searchParams.get('course') || ''

  try {
    // 1. Get user profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('roll_no')
      .eq('id', user.id)
      .single()

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    // 2. Get student id
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('roll_no', profile.roll_no)
      .single()

    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

    // 3. Get enrolled courses
    const { data: enrollments } = await supabase
      .from('student_courses')
      .select('course_abbr')
      .eq('student_id', student.id)

    const enrolledCourseAbbrs = enrollments?.map(e => e.course_abbr) || []

    if (enrolledCourseAbbrs.length === 0) {
      return NextResponse.json({ materials: [] })
    }

    // 4. Fetch materials for enrolled courses
    let query = supabase
      .from('course_materials')
      .select('*')
      .in('course_abbr', enrolledCourseAbbrs)
      .order('created_at', { ascending: false })

    if (courseAbbr) {
      query = query.eq('course_abbr', courseAbbr)
    }

    if (q) {
      query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`)
    }

    const { data: materials, error } = await query

    if (error) throw error

    return NextResponse.json({ materials })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
