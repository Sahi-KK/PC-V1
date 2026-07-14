import { NextRequest, NextResponse } from 'next/server'
import { createClient as supabaseCreateClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-server'
import crypto from 'crypto'

function getService() {
  return supabaseCreateClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function generateToken(userId: string, courseId: string, date: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || 'fallback-secret'
  return crypto.createHmac('sha256', secret).update(`${userId}:${courseId}:${date}`).digest('hex')
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = getService()
  const appScriptUrl = process.env.APPSCRIPT_WEBHOOK_URL
  
  if (!appScriptUrl) {
    return NextResponse.json({ error: 'APPSCRIPT_WEBHOOK_URL not configured' }, { status: 500 })
  }

  // Get tomorrow's date string YYYY-MM-DD
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const displayDate = tomorrow.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  // 1. Get the current user profile
  const { data: userProfile, error: uErr } = await service.from('user_profiles').select('id, name, email, roll_no').eq('id', user.id).single()
  if (uErr || !userProfile) {
    return NextResponse.json({ error: 'Could not fetch user profile' }, { status: 500 })
  }

  // Pre-fetch all courses to map abbreviations to names
  const { data: allCourses } = await service.from('courses').select('abbr, full_name, faculty')
  const courseMap: Record<string, any> = {}
  allCourses?.forEach(c => { courseMap[c.abbr] = c })

  // get student ID
  const { data: student } = await service.from('students').select('id').eq('roll_no', userProfile.roll_no).single()
  if (!student) return NextResponse.json({ error: 'Student record not found for you.' }, { status: 404 })

  // get enrolled courses
  const { data: enrollments } = await service.from('student_courses').select('course_abbr, section').eq('student_id', student.id)
  if (!enrollments || enrollments.length === 0) return NextResponse.json({ error: 'No enrollments found for you.' }, { status: 404 })

  const orFilters = enrollments.map(e => `and(course_abbr.eq.${e.course_abbr},section.eq.${e.section})`).join(',')
  
  // fetch calendar entries for TOMORROW for these enrollments
  const { data: entries } = await service.from('calendar_entries')
    .select('*')
    .eq('date', tomorrowStr)
    .or(orFilters)
    .order('time_slot', { ascending: true })

  if (!entries || entries.length === 0) return NextResponse.json({ message: 'You have no classes scheduled for tomorrow.' })

  // Pre-fetch user's existing attendance for these entries
  const entryIds = entries.map(e => e.id)
  const { data: attendanceData } = await service.from('attendance')
    .select('calendar_entry_id, is_present')
    .eq('user_id', userProfile.id)
    .in('calendar_entry_id', entryIds)

  const attendanceMap: Record<string, boolean> = {}
  attendanceData?.forEach(a => {
    attendanceMap[a.calendar_entry_id] = a.is_present
  })

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pc-v1-portal.vercel.app'

  // Generate HTML for the email
  let classesHtml = ''
  for (const entry of entries) {
    const courseInfo = courseMap[entry.course_abbr]
    const courseName = courseInfo?.full_name || entry.course_abbr
    
    const isPresent = attendanceMap[entry.id]
    const token = generateToken(userProfile.id, entry.id, tomorrowStr)
    const markPresentUrl = `${baseUrl}/api/attendance/mark-email?user_id=${userProfile.id}&course_id=${entry.id}&date=${tomorrowStr}&status=present&token=${token}`
    
    const actionHtml = isPresent 
      ? `<div style="display: inline-block; background-color: #f3f4f6; color: #10b981; padding: 10px 20px; border-radius: 6px; font-weight: 600; font-size: 14px; border: 1px solid #10b981;">✓ Already marked present from App</div>`
      : `<a href="${markPresentUrl}" style="display: inline-block; background-color: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">✓ Mark Present</a>`

    classesHtml += `
      <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
        <div style="font-size: 14px; font-weight: 600; color: #4f46e5; margin-bottom: 4px;">${entry.time_slot}</div>
        <div style="font-size: 18px; font-weight: 700; color: #111827; margin-bottom: 4px;">${courseName} (${entry.course_abbr})</div>
        <div style="font-size: 14px; color: #6b7280; margin-bottom: 16px;">LR: ${entry.lr || 'N/A'} • Faculty: ${courseInfo?.faculty || ''}</div>
        ${actionHtml}
      </div>
    `
  }

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb; padding: 24px; border-radius: 12px;">
      <h1 style="color: #111827; font-size: 24px; margin-bottom: 8px; text-align: center;">Tomorrow's Timetable (TEST)</h1>
      <p style="color: #6b7280; font-size: 16px; text-align: center; margin-bottom: 32px;">${displayDate}</p>
      
      <p style="color: #374151; font-size: 16px; margin-bottom: 24px;">Hi ${userProfile.name.split(' ')[0]}, here is a test email of your schedule for tomorrow. You can optionally pre-mark your attendance.</p>
      
      ${classesHtml}
      
      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px;">
        <p>PC-V1 Portal Automated System (TEST)</p>
      </div>
    </div>
  `

  // Call Apps Script webhook
  try {
    const res = await fetch(appScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: userProfile.email,
        subject: `[TEST] Term IV Schedule`,
        htmlBody: htmlBody
      })
    })
    
    const text = await res.text()
    
    try {
      const result = JSON.parse(text)
      if (result.status === 'success') {
        return NextResponse.json({ success: true, message: `Test email successfully triggered for ${userProfile.email}!` })
      } else {
        return NextResponse.json({ error: result.message, raw: text }, { status: 500 })
      }
    } catch(e) {
       return NextResponse.json({ error: 'Apps Script returned unexpected response', raw: text.substring(0, 500) }, { status: 500 })
    }
  } catch (e: any) {
    return NextResponse.json({ error: 'Fetch error: ' + (e.message || e.toString()) }, { status: 500 })
  }
}
