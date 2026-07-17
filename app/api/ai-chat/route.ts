import { NextRequest, NextResponse } from 'next/server'
export const maxDuration = 60;
import { createClient } from '@/lib/supabase-server'
import { createClient as supabaseCreateClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import fs from 'fs'
import path from 'path'
import { PLACEMENT_POLICY, PLACEMENT_REPORT } from '@/lib/placementData'

const GROQ_API_KEY = process.env.GROQ_API_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const service = supabaseCreateClient(supabaseUrl, supabaseServiceKey)
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)

// ─── Course full name cache ───────────────────────────────────────────────────
let courseCache: Record<string, { full_name: string; faculty: string; faculty_abbr: string; credit: number }> | null = null
let courseCacheTime = 0
async function getCourseCache() {
  if (courseCache && Date.now() - courseCacheTime < 3600_000) return courseCache
  const { data } = await service.from('courses').select('abbr,full_name,faculty,faculty_abbr,credit')
  courseCache = {}
  data?.forEach((c: any) => { courseCache![c.abbr] = c })
  courseCacheTime = Date.now()
  return courseCache!
}

// ─── Tool executor ────────────────────────────────────────────────────────────
async function executeTool(name: string, args: any, today: string, callerUserId?: string): Promise<string> {

  // 1. GET STUDENT SCHEDULE
  if (name === 'get_student_schedule') {
    const { student_name, roll_no, date, week } = args

    let studentQuery = service.from('students').select('id,roll_no,name')
    if (roll_no) {
      studentQuery = studentQuery.ilike('roll_no', `%${roll_no}%`)
    } else if (student_name) {
      studentQuery = studentQuery.ilike('name', `%${student_name}%`)
    } else {
      return 'Error: Please provide either student_name or roll_no.'
    }
    const { data: students } = await studentQuery.limit(5)
    if (!students || students.length === 0) return `No student found matching "${student_name || roll_no}".`

    const student = students[0]
    const { data: enrollments } = await service.from('student_courses').select('course_abbr,section').eq('student_id', student.id)
    if (!enrollments || enrollments.length === 0) return `${student.name} has no course enrollments in the database.`

    const orFilters = enrollments.map(({ course_abbr, section }: any) => `and(course_abbr.eq.${course_abbr},section.eq.${section})`).join(',')

    let query = service.from('calendar_entries')
      .select('date,day_of_week,time_slot,class_code,course_abbr,section,lr,is_holiday')
      .or(orFilters)
      .eq('is_holiday', false)

    if (date) {
      query = query.eq('date', date)
    } else if (week) {
      const start = new Date(today)
      const end = new Date(today); end.setDate(end.getDate() + 7)
      query = query.gte('date', start.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })).lte('date', end.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }))
    } else {
      query = query.gte('date', today).limit(25)
    }

    const { data: entries } = await query.order('date').order('time_slot')
    const courses = await getCourseCache()

    const enriched = entries?.map((e: any) => ({
      date: e.date,
      day: e.day_of_week,
      time: e.time_slot,
      course: courses[e.course_abbr]?.full_name || e.course_abbr,
      course_abbr: e.course_abbr,
      faculty: courses[e.course_abbr]?.faculty || '',
      section: e.section,
      room: e.lr,
      class_code: e.class_code
    }))

    return JSON.stringify({ student: student.name, roll_no: student.roll_no, schedule: enriched || [] })
  }

  // 2. GET MY SCHEDULE (logged-in user)
  if (name === 'get_my_schedule') {
    const { date, week } = args
    if (!callerUserId) return 'Could not identify the logged-in user.'

    const { data: profile } = await service.from('user_profiles').select('roll_no,name').eq('id', callerUserId).single()
    if (!profile?.roll_no) return 'Your profile is not linked to a roll number yet.'

    const { data: studentRow } = await service.from('students').select('id,name').eq('roll_no', profile.roll_no).single()
    if (!studentRow) return 'Student record not found.'

    const { data: enrollments } = await service.from('student_courses').select('course_abbr,section').eq('student_id', studentRow.id)
    if (!enrollments || enrollments.length === 0) return 'You are not enrolled in any courses.'

    const orFilters = enrollments.map(({ course_abbr, section }: any) => `and(course_abbr.eq.${course_abbr},section.eq.${section})`).join(',')

    let query = service.from('calendar_entries')
      .select('date,day_of_week,time_slot,class_code,course_abbr,section,lr,session_number')
      .or(orFilters)
      .eq('is_holiday', false)

    if (date) {
      query = query.eq('date', date)
    } else if (week) {
      const end = new Date(today); end.setDate(end.getDate() + 7)
      query = query.gte('date', today).lte('date', end.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }))
    } else {
      query = query.gte('date', today).limit(20)
    }

    const { data: entries } = await query.order('date').order('time_slot')
    const courses = await getCourseCache()

    const enriched = entries?.map((e: any) => ({
      date: e.date, day: e.day_of_week, time: e.time_slot,
      course: courses[e.course_abbr]?.full_name || e.course_abbr,
      course_abbr: e.course_abbr,
      faculty: courses[e.course_abbr]?.faculty || '',
      section: e.section, room: e.lr, session: e.session_number
    }))

    return JSON.stringify({ name: profile.name, roll_no: profile.roll_no, schedule: enriched || [] })
  }

  // 3. GET MY ATTENDANCE
  if (name === 'get_my_attendance') {
    const { course_abbr } = args
    if (!callerUserId) return 'Could not identify the logged-in user.'

    const { data: profile } = await service.from('user_profiles').select('roll_no,name').eq('id', callerUserId).single()
    if (!profile?.roll_no) return 'Your profile is not linked yet.'

    const { data: studentRow } = await service.from('students').select('id').eq('roll_no', profile.roll_no).single()
    if (!studentRow) return 'Student record not found.'

    const { data: enrollments } = await service.from('student_courses').select('course_abbr,section').eq('student_id', studentRow.id)
    if (!enrollments) return 'No enrollments found.'

    const courses = await getCourseCache()
    const results: any[] = []

    for (const enr of enrollments) {
      if (course_abbr && enr.course_abbr !== course_abbr.toUpperCase()) continue

      const orFilter = `and(course_abbr.eq.${enr.course_abbr},section.eq.${enr.section})`
      const { data: classEntries } = await service.from('calendar_entries')
        .select('id,date,time_slot,session_number')
        .or(orFilter)
        .lte('date', today)
        .eq('is_holiday', false)
        .order('date')

      if (!classEntries) continue

      const { data: attRecords } = await service.from('attendance')
        .select('calendar_entry_id,is_present')
        .eq('user_id', callerUserId)
        .in('calendar_entry_id', classEntries.map((e: any) => e.id))

      const attMap = new Map(attRecords?.map((a: any) => [a.calendar_entry_id, a.is_present]))
      const total = classEntries.length
      const marked = classEntries.filter((e: any) => attMap.has(e.id))
      const present = marked.filter((e: any) => attMap.get(e.id) === true).length

      results.push({
        course: courses[enr.course_abbr]?.full_name || enr.course_abbr,
        course_abbr: enr.course_abbr,
        section: enr.section,
        total_classes_held: total,
        classes_marked: marked.length,
        classes_unmarked: total - marked.length,
        present: present,
        absent: marked.length - present,
        attendance_percentage: marked.length > 0 ? Math.round((present / marked.length) * 100) : null
      })
    }

    return JSON.stringify({ name: profile.name, attendance: results })
  }

  // 4. GET COURSE INFO
  if (name === 'get_course_info') {
    const { query } = args
    const { data: courses } = await service.from('courses')
      .select('abbr,full_name,faculty,faculty_abbr,credit')
      .or(`abbr.ilike.%${query}%,full_name.ilike.%${query}%,faculty.ilike.%${query}%`)

    if (!courses || courses.length === 0) return `No course found matching "${query}".`

    const enriched = await Promise.all(courses.map(async (c: any) => {
      const { data: sections } = await service.from('student_courses')
        .select('section')
        .eq('course_abbr', c.abbr)
      const uniqueSections = [...new Set(sections?.map((s: any) => s.section) || [])]
      return { ...c, sections: uniqueSections.sort() }
    }))

    return JSON.stringify(enriched)
  }

  // 5. GET ALL COURSES
  if (name === 'get_all_courses') {
    const { data: courses } = await service.from('courses').select('abbr,full_name,faculty,credit').order('abbr')
    return JSON.stringify(courses || [])
  }

  // 6. GET CLASSES ON DATE (for all sections)
  if (name === 'get_classes_on_date') {
    const { date, section } = args
    let query = service.from('calendar_entries')
      .select('date,day_of_week,section,time_slot,course_abbr,class_code,lr,is_holiday')
      .eq('date', date)
      .eq('is_holiday', false)

    if (section) query = query.eq('section', section.toUpperCase())

    const { data: entries } = await query.order('section').order('time_slot')
    const courses = await getCourseCache()
    const enriched = entries?.map((e: any) => ({
      ...e,
      course_full_name: courses[e.course_abbr]?.full_name || e.course_abbr,
      faculty: courses[e.course_abbr]?.faculty || ''
    }))

    return JSON.stringify({ date, entries: enriched || [] })
  }

  // 7. SEARCH STUDENT
  if (name === 'search_student') {
    const { query } = args
    const { data: students } = await service.from('students')
      .select('roll_no,name')
      .or(`name.ilike.%${query}%,roll_no.ilike.%${query}%`)
      .limit(10)

    if (!students || students.length === 0) return `No student found matching "${query}".`

    const enriched = await Promise.all(students.map(async (s: any) => {
      const { data: courses } = await service.from('student_courses')
        .select('course_abbr,section')
        .eq('student_id', (await service.from('students').select('id').eq('roll_no', s.roll_no).single()).data?.id)
      return { ...s, enrolled_courses: courses || [] }
    }))

    return JSON.stringify(enriched)
  }

  // 8. GET SPOC DIRECTORY
  if (name === 'search_spoc_directory') {
    const { query } = args
    try {
      const spocsPath = path.join(process.cwd(), 'data', 'spocs.json')
      const spocsData = JSON.parse(fs.readFileSync(spocsPath, 'utf-8'))
      const q = (query || '').toLowerCase()
      const found = spocsData.filter((s: any) =>
        s.name?.toLowerCase().includes(q) || s.roll_no?.toLowerCase().includes(q)
      )
      return found.length > 0 ? JSON.stringify(found) : `No SPOC found for "${query}".`
    } catch {
      return 'SPOC directory unavailable.'
    }
  }

  // 9. GET COURSE MATERIALS
  if (name === 'get_course_materials') {
    const { query } = args
    const { data: materials } = await service.from('materials')
      .select('*')
      .or(`title.ilike.%${query}%,description.ilike.%${query}%,course_abbr.ilike.%${query}%`)
    return materials && materials.length > 0 ? JSON.stringify(materials) : `No materials found for "${query}".`
  }

  // 10. QUERY PLACEMENT KNOWLEDGE
  if (name === 'query_placement_knowledge') {
    return `[POLICY DOCUMENT]\n${PLACEMENT_POLICY}\n\n[REPORT DOCUMENT]\n${PLACEMENT_REPORT}`;
  }

  return `Unknown tool: ${name}`
}

// ─── Tool definitions ─────────────────────────────────────────────────────────
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_my_schedule',
      description: 'Get the schedule/timetable for the currently logged-in user. Use when the user says "my schedule", "my classes", "what do I have today", etc.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Specific date in YYYY-MM-DD. Use for "today", "tomorrow", or a specific date.' },
          week: { type: 'boolean', description: 'Set true for "this week" or "next 7 days".' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_my_attendance',
      description: 'Get attendance summary for the currently logged-in user across all courses or a specific course.',
      parameters: {
        type: 'object',
        properties: {
          course_abbr: { type: 'string', description: 'Optional course abbreviation (e.g. "CV", "GBS") to filter by a single course.' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_student_schedule',
      description: 'Get the schedule for any specific student by name or roll number.',
      parameters: {
        type: 'object',
        properties: {
          student_name: { type: 'string', description: 'Full or partial name of the student.' },
          roll_no: { type: 'string', description: 'Roll number of the student (e.g. PGP16001, IPM04032).' },
          date: { type: 'string', description: 'Specific date in YYYY-MM-DD format.' },
          week: { type: 'boolean', description: 'Set true for upcoming 7 days.' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_classes_on_date',
      description: 'Get all classes scheduled across all sections on a specific date.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Date in YYYY-MM-DD format.' },
          section: { type: 'string', description: 'Optional section filter: A, B, C, or D.' }
        },
        required: ['date']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_course_info',
      description: 'Get details about a course — full name, faculty, credit, which sections it is taught in.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Course name, abbreviation (e.g. "CV", "GBS"), or faculty name.' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_all_courses',
      description: 'Get the complete list of all Term IV courses with faculty and credit information.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_student',
      description: 'Search for a student by name or roll number and get their enrolled courses and sections.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Student name or roll number to search.' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_spoc_directory',
      description: 'Find the SPOC (Student Point of Contact) for a student.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Student name or roll number.' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_course_materials',
      description: 'Search for course materials, case studies, or datasets.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Course name, abbreviation, or keyword.' }
        },
        required: ['query']
      }
    }
  }
]

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { prompt, fileBase64, mimeType } = await req.json()

    // ── Document / Image upload → Gemini handwritten notes ──
    if (fileBase64 && mimeType) {
      if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured.')
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
      const promptText = 'Read the attached document/image and act as a strategic decision-maker. Create a Decision Sheet that identifies the core problems presented in the document, and for each problem, map out clear, actionable solutions or suggestions. Output plain text ONLY without any markdown formatting. Format it as continuous natural paragraphs suitable for realistic handwritten notes. Start by stating the problems clearly, followed by the proposed solutions mapping. User query context: ' + prompt
      const result = await model.generateContent([promptText, { inlineData: { data: fileBase64, mimeType } }])
      return NextResponse.json({ reply: result.response.text(), type: 'handwritten_notes' })
    }

    // ── Identify logged-in user ──
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const callerUserId = user?.id

    // Timezone-safe today's date (IST)
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

    // ─────────────────────────────────────────────────────────────────────────
    // PATH A: Placement questions → Gemini SDK directly (1M token context,
    //         no tool-calling overhead, no TPM rate-limit issues)
    // ─────────────────────────────────────────────────────────────────────────
    const PLACEMENT_KEYWORDS = [
      'placement policy', 'placement report', 'placement rule', 'placement stat',
      'placement process', 'placement eligibility', 'iimr placement', 'iim rohtak placement',
      'ppo', 'pre-placement offer', 'shortlist', 'shortlisting',
      'highest package', 'highest salary', 'average package', 'average salary', 'median salary',
      'top recruiter', 'recruiter', 'reject offer', 'offer reject', 'opting out',
      'case competition', 'freeze', 'placement freeze'
    ]
    const lower = prompt.toLowerCase()
    const isPlacementQuery = PLACEMENT_KEYWORDS.some(kw => lower.includes(kw)) ||
      (/\bplacement\b/i.test(prompt) && !/my placement/i.test(prompt))

    if (isPlacementQuery) {
      if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured.')
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
      const placementPrompt = `You are the AI Assistant for PC-V1 Academic Portal at IIM Rohtak. The user has a question about IIM Rohtak's placement process.

Here are the two official documents to reference:

===== 2026-2027 PLACEMENT POLICY =====
${PLACEMENT_POLICY}

===== 2024-2026 FINAL PLACEMENT REPORT =====
${PLACEMENT_REPORT}

Based ONLY on the above documents, answer the user's question accurately and in detail. If the answer is in the Policy, cite the specific rule. If it is in the Report, cite the specific statistic. If neither document contains the answer, say so clearly.

User question: ${prompt}`

      const result = await model.generateContent(placementPrompt)
      return NextResponse.json({ reply: result.response.text() })
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATH B: All other queries → Groq with tool-calling
    //         (schedule, attendance, courses, students — small DB results)
    // ─────────────────────────────────────────────────────────────────────────
    const systemPrompt = `You are the AI Assistant for the PC-V1 Academic Portal at IIM Rohtak.
Today's date is ${today} (use this for "today", "tomorrow", "this week" queries).

You have access to the live student database. ALWAYS call the appropriate tool before answering any question about schedules, courses, attendance, students, or faculty. Never guess or hallucinate data.

DATABASE KNOWLEDGE:
- Term: Term IV, PGP Batch 16 (PGP16xxx), IPM Batch 4 (IPM04xxx), PGP Batch 15 (PGP15xxx)
- Sections: A (LR 02), B (LR 07), C/D (LR 06)
- Time slots: 08:45-10:00, 10:20-11:35, 11:55-13:10, [LUNCH], 14:30-15:45, 16:05-17:20, 17:40-18:55, 19:15-20:30, 20:50-22:05, 22:25-23:40
- Holidays: June 26 (Muharram), Aug 15 (Independence Day)
- End-term exams: Aug 23 – Sep 3
- 31 courses total, all with faculty assigned
- 724 class sessions scheduled for the term
- 2568 student-course enrollments across 301 students

TOOL USAGE RULES:
- "my schedule / my classes / what do I have" → get_my_schedule
- "my attendance" → get_my_attendance  
- "[Name]'s schedule / schedule of [Name]" → get_student_schedule
- "classes on [date] / what's on [date]" → get_classes_on_date
- "tell me about [course] / who teaches [course]" → get_course_info
- "all courses / list all subjects" → get_all_courses
- "find student [name]" → search_student
- "SPOC for [name]" → search_spoc_directory

When presenting schedules, format them clearly grouped by date. Mention the faculty name alongside each course. Be concise and helpful.`

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ]

    // ── First LLM call (Groq) ──
    let response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, tools: TOOLS, tool_choice: 'auto' })
    })

    let data = await response.json()
    if (!response.ok) throw new Error(data.error?.message || 'AI service error')

    let message = data.choices[0].message

    // ── Tool calling loop (up to 3 rounds) ──
    let rounds = 0
    while (message.tool_calls && rounds < 3) {
      rounds++
      messages.push(message)

      for (const toolCall of message.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments || '{}')
        const result = await executeTool(toolCall.function.name, args, today, callerUserId)
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: result })
      }

      response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages })
      })
      data = await response.json()
      if (!response.ok) throw new Error(data.error?.message || 'AI service error')
      message = data.choices[0].message
    }

    return NextResponse.json({ reply: message.content })
  } catch (error: any) {
    console.error('[ai-chat error]', error)
    return NextResponse.json({ reply: 'Error: ' + error.message }, { status: 500 })
  }
}
