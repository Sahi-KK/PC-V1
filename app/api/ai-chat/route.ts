import { NextRequest, NextResponse } from 'next/server'
import { createClient as supabaseCreateClient } from '@supabase/supabase-js'

const GROQ_API_KEY = process.env.GROQ_API_KEY
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const service = supabaseCreateClient(supabaseUrl, supabaseServiceKey)

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json()

    // Get current date to help LLM
    const today = new Date().toISOString().split('T')[0];

    const systemPrompt = `You are a helpful AI Scheduling Assistant for the PC-V1 Portal. 
Your job is to answer scheduling queries accurately. 
Today's date is ${today}.
To do this, you have access to a tool called 'get_student_schedule' which takes a 'student_name' and optionally a 'date' (YYYY-MM-DD).
Always use the tool to fetch the schedule before answering.

Standard daily time slots often include: 08:45-10:00, 10:15-11:30, 11:45-13:00, 14:30-15:45, 16:05-17:20, 17:40-18:55.
If the schedule returned for a specific date does NOT contain an entry for a common time slot, that means the student is FREE during that slot.
Respond concisely, naturally, and accurately.`

    const tools = [
      {
        type: 'function',
        function: {
          name: 'get_student_schedule',
          description: 'Get the timetable/schedule for a specific student, optionally on a specific date.',
          parameters: {
            type: 'object',
            properties: {
              student_name: { type: 'string', description: 'The name of the student to search for (e.g. "Arjun", "Aditi").' },
              date: { type: 'string', description: 'The specific date in YYYY-MM-DD format (e.g. "2026-06-20"), if the user mentions a date or "today"/"tomorrow".' }
            },
            required: ['student_name']
          }
        }
      }
    ]

    let messages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ]

    let response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        tools,
        tool_choice: 'auto'
      })
    })

    let data = await response.json()
    
    if (!response.ok) {
        throw new Error(data.error?.message || 'Groq API error')
    }
    
    let message = data.choices[0].message

    if (message.tool_calls) {
      messages.push(message) 

      for (const toolCall of message.tool_calls) {
        if (toolCall.function.name === 'get_student_schedule') {
          const args = JSON.parse(toolCall.function.arguments)
          
          // Search for student
          const { data: students } = await service
            .from('students')
            .select('id, roll_no, name')
            .ilike('name', `%${args.student_name}%`)
            
          if (!students || students.length === 0) {
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: `No student found matching name "${args.student_name}". Please ask the user to clarify the name.`
              })
              continue;
          }
          
          const targetStudent = students[0]
          
          const { data: userCourses } = await service
            .from('student_courses')
            .select('course_abbr, section')
            .eq('student_id', targetStudent.id)
            
          const courseAbbrSectionPairs = userCourses?.filter(uc => uc.course_abbr !== 'CW-') || []
          
          if (courseAbbrSectionPairs.length === 0) {
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: `Student ${targetStudent.name} is not enrolled in any courses.`
              })
              continue;
          }

          const orFilters = courseAbbrSectionPairs.map(
            ({ course_abbr, section }) => `and(course_abbr.eq.${course_abbr},section.eq.${section})`
          ).join(',')

          let query = service
            .from('calendar_entries')
            .select('date, time_slot, class_code, course_abbr, lr')
            .or(orFilters)
          
          if (args.date) {
              query = query.eq('date', args.date)
          } else {
              query = query.gte('date', today).order('date').limit(20)
          }

          const { data: entries } = await query

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({
                found_student: targetStudent.name,
                requested_date: args.date || 'upcoming 20 classes',
                schedule: entries || []
            })
          })
        }
      }

      response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages
        })
      })

      data = await response.json()
      
      if (!response.ok) {
          throw new Error(data.error?.message || 'Groq API error')
      }
      
      message = data.choices[0].message
    }

    return NextResponse.json({ reply: message.content })
  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ reply: 'Error: ' + error.message }, { status: 500 })
  }
}
