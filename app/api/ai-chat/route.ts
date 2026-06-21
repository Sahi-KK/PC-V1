import { NextRequest, NextResponse } from 'next/server'
import { createClient as supabaseCreateClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import fs from 'fs'
import path from 'path'

const GROQ_API_KEY = process.env.GROQ_API_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const service = supabaseCreateClient(supabaseUrl, supabaseServiceKey)
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const { prompt, fileBase64, mimeType } = await req.json()

    // Handle Document/Image Upload with Gemini
    if (fileBase64 && mimeType) {
      if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured on the server.");
      
      const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
      
      const promptText = "Read the attached document/image. Extract and summarize the key points, charts, and information in detail. Output plain text ONLY without any markdown formatting (no asterisks, no hash symbols, no bullet points). Format it as continuous paragraphs suitable for realistic handwritten notes. Keep it concise but highly informative. User query context: " + prompt;
      
      const result = await model.generateContent([
        promptText,
        {
          inlineData: {
            data: fileBase64,
            mimeType: mimeType
          }
        }
      ]);
      
      const responseText = result.response.text();
      
      return NextResponse.json({ reply: responseText, type: 'handwritten_notes' });
    }

    // Get current date to help LLM
    const today = new Date().toISOString().split('T')[0];

    const systemPrompt = `You are a helpful AI Assistant for the PC-V1 Portal.
Your job is to answer queries accurately about the app, schedules, materials, and SPOCs.
Today's date is ${today}.

About the App:
- Home: Shows the user's schedule, enrolled courses progress, and upcoming classes.
- Process Date: Shows overall schedules and lets users check other students' schedules.
- Misc: Contains Expenses (split and track shared costs), SPOC Directory (find Student Point of Contacts for batches), and Materials (cases, datasets, slides for courses).
- Profile: User details and enrolled courses.
- Notifications: Native push notifications for expenses and updates.

You have access to the following tools:
1. 'get_student_schedule': Fetch the timetable for a specific student, optionally on a specific date. 
   - Note: Standard daily time slots often include: 08:45-10:00, 10:15-11:30, 11:45-13:00, 14:30-15:45, 16:05-17:20, 17:40-18:55. If the schedule returned for a specific date does NOT contain an entry for a common time slot, that means the student is FREE during that slot.
2. 'search_spoc_directory': Find the assigned SPOC (Student Point of Contact) for a student name or roll number.
3. 'get_course_materials': Search for materials, case studies, or datasets related to a course.

Always use the appropriate tool before answering questions about data. If a tool returns no data, inform the user accordingly. Respond concisely, naturally, and accurately. Do not invent or hallucinate data.`

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
      },
      {
        type: 'function',
        function: {
          name: 'search_spoc_directory',
          description: 'Search the SPOC directory to find the assigned SPOC for a student.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'The name or roll number of the student to find the SPOC for.' }
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
              query: { type: 'string', description: 'The course name, abbreviation, or keyword (e.g. "Pricing Strategies", "FADT").' }
            },
            required: ['query']
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
        } else if (toolCall.function.name === 'search_spoc_directory') {
          const args = JSON.parse(toolCall.function.arguments)
          try {
            const spocsPath = path.join(process.cwd(), 'data', 'spocs.json')
            const spocsData = JSON.parse(fs.readFileSync(spocsPath, 'utf-8'))
            
            const q = (args.query || '').toLowerCase()
            const found = spocsData.filter((s: any) => 
                s.name.toLowerCase().includes(q) || 
                s.roll_no.toLowerCase().includes(q)
            )
            
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: found.length > 0 
                ? JSON.stringify(found) 
                : `No SPOC found for student "${args.query}".`
            })
          } catch (e) {
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: `Error reading SPOC directory.`
            })
          }
        } else if (toolCall.function.name === 'get_course_materials') {
          const args = JSON.parse(toolCall.function.arguments)
          const q = args.query || ''
          const { data: materials } = await service
            .from('materials')
            .select('*')
            .or(`title.ilike.%${q}%,description.ilike.%${q}%,course_abbr.ilike.%${q}%`)
            
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: materials && materials.length > 0 
                ? JSON.stringify(materials) 
                : `No materials found for "${q}".`
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
