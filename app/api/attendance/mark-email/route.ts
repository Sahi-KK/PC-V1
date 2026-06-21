import { NextRequest, NextResponse } from 'next/server'
import { createClient as supabaseCreateClient } from '@supabase/supabase-js'
import crypto from 'crypto'

function getService() {
  return supabaseCreateClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function verifyToken(userId: string, courseId: string, date: string, token: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || 'fallback-secret'
  const expected = crypto.createHmac('sha256', secret).update(`${userId}:${courseId}:${date}`).digest('hex')
  return expected === token
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const user_id = searchParams.get('user_id')
  const course_id = searchParams.get('course_id') // Maps to calendar_entries id
  const date = searchParams.get('date')
  const status = searchParams.get('status')
  const token = searchParams.get('token')

  if (!user_id || !course_id || !date || !status || !token) {
    return NextResponse.redirect(new URL('/attendance-success?error=Missing parameters', req.url))
  }

  if (!verifyToken(user_id, course_id, date, token)) {
    return NextResponse.redirect(new URL('/attendance-success?error=Invalid secure token', req.url))
  }

  const service = getService()

  // Find user's student profile
  const { data: userProf } = await service.from('user_profiles').select('roll_no').eq('id', user_id).single()
  if (!userProf) return NextResponse.redirect(new URL('/attendance-success?error=User not found', req.url))

  const { data: student } = await service.from('students').select('id').eq('roll_no', userProf.roll_no).single()
  if (!student) return NextResponse.redirect(new URL('/attendance-success?error=Student profile not found', req.url))

  // Find the exact calendar entry to get the course_abbr
  const { data: entry } = await service.from('calendar_entries').select('course_abbr, time_slot').eq('id', course_id).single()
  if (!entry) return NextResponse.redirect(new URL('/attendance-success?error=Schedule entry not found', req.url))

  // Upsert attendance record
  // Assuming the `attendance` table uses `student_id`, `course_abbr`, `date` as unique constraint
  // But wait, there might be multiple classes for the same course on the same day. 
  // Let's check how the attendance table is structured. The app usually tracks attendance by course + date.
  
  const { error: upsertErr } = await service.from('attendance').upsert({
    user_id: user_id,
    calendar_entry_id: course_id,
    is_present: true
  }, { onConflict: 'user_id, calendar_entry_id' })

  if (upsertErr) {
    console.error("Upsert error:", upsertErr)
    return NextResponse.redirect(new URL(`/attendance-success?error=Database error: ${upsertErr.message}`, req.url))
  }

  return NextResponse.redirect(new URL(`/attendance-success?course=${entry.course_abbr}&time=${entry.time_slot}`, req.url))
}
