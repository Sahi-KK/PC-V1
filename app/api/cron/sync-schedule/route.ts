import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Papa from 'papaparse'

// Initialize Supabase service role client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1bnjl5IXxER0pWvxG75TswZyMxm7Gxk4S4UCUxQKikzc/export?format=csv'
const REAL_HOLIDAYS = new Set(['2026-06-26', '2026-08-15'])
const EXAM_START = '2026-08-23'

const DAY_NAMES: Record<number, string> = {
  0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 
  4: 'Thursday', 5: 'Friday', 6: 'Saturday'
}

const TIME_SLOTS: Record<number, string> = {
  2: '08:45-10:00',
  3: '10:20-11:35',
  4: '11:55-13:10',
  6: '14:30-15:45',
  7: '16:05-17:20',
  8: '17:40-18:55',
  9: '19:15-20:30',
  10: '20:50-22:05',
  11: '22:25-23:40'
}

const SECTION_LR: Record<string, string> = {
  'A': 'LR 02',
  'B': 'LR 07',
  'C': 'LR 06',
  'D': 'LR 06'
}

function parseCell(val: string) {
  if (!val) return null
  val = val.trim()
  if (['nan', '', 'LUNCH', 'SUNDAY', 'Sunday'].includes(val) || val.includes('End Term') || val.startsWith('Term') || val.startsWith('Date') || val.startsWith('Section')) {
    return null
  }
  
  // Lenient regex to handle typos like 'IBS7 (PD)' or 'MBPET 14 (RN'
  const match = val.match(/^([a-zA-Z\s]+?)\s*(\d+)\s*\(([^)]+)\)?\s*$/)
  if (!match) return null
  
  return {
    course_abbr: match[1].trim(),
    session_number: parseInt(match[2]),
    faculty_abbr: match[3].trim()
  }
}

export async function GET(request: Request) {
  try {
    // 1. Fetch live CSV
    const response = await fetch(SHEET_URL)
    if (!response.ok) throw new Error('Failed to fetch Google Sheet')
    const csvText = await response.text()
    
    // 2. Parse CSV
    const { data: rows } = Papa.parse<string[]>(csvText, { skipEmptyLines: true })
    
    const groundTruth: Record<string, any> = {}
    let currentDate: string | null = null
    
    // 3. Extract Schedule
    for (let idx = 2; idx < rows.length; idx++) {
      const row = rows[idx]
      const dateVal = row[0]?.trim()
      const sect = row[1]?.trim() || ''
      
      if (dateVal && dateVal !== '') {
        const parsedDate = new Date(dateVal)
        if (!isNaN(parsedDate.getTime())) {
          currentDate = parsedDate.toISOString().split('T')[0]
        } else if (dateVal.includes('End Term')) {
          break
        }
      }
      
      if (!currentDate || !['A', 'B', 'C', 'D'].includes(sect)) continue
      
      for (const [colIdxStr, timeSlot] of Object.entries(TIME_SLOTS)) {
        const colIdx = parseInt(colIdxStr)
        const cellValue = row[colIdx]
        const parsed = parseCell(cellValue)
        
        if (!parsed) continue
        
        const dt = new Date(currentDate)
        const dayOfWeek = DAY_NAMES[dt.getDay()]
        const key = `${currentDate}_${timeSlot}_${sect}_${parsed.course_abbr}`
        
        groundTruth[key] = {
          date: currentDate,
          day_of_week: dayOfWeek,
          time_slot: timeSlot,
          section: sect,
          course_abbr: parsed.course_abbr,
          session_number: parsed.session_number,
          class_code: `${parsed.course_abbr} ${parsed.session_number} (${parsed.faculty_abbr})`,
          lr: SECTION_LR[sect] || 'LR 02',
          is_holiday: REAL_HOLIDAYS.has(currentDate),
          is_exam_period: currentDate >= EXAM_START,
        }
      }
    }

    // 4. Fetch current DB entries
    const { data: dbEntries, error: dbError } = await supabase
      .from('calendar_entries')
      .select('id, date, time_slot, section, course_abbr, session_number, class_code, lr, is_holiday, is_exam_period')
    
    if (dbError) throw dbError

    const dbMap: Record<string, any> = {}
    dbEntries.forEach(e => {
      const key = `${e.date}_${e.time_slot}_${e.section}_${e.course_abbr}`
      dbMap[key] = e
    })

    // 5. Diff Engine
    const toAdd: any[] = []
    const toRemove: any[] = []
    
    for (const key in groundTruth) {
      if (!dbMap[key]) {
        toAdd.push(groundTruth[key])
      }
    }
    
    for (const key in dbMap) {
      if (!groundTruth[key]) {
        toRemove.push(dbMap[key])
      }
    }

    let deletedCount = 0
    let keptCount = 0
    let insertedCount = 0

    // 6. Safe Deletions (Protect Attendance)
    for (const entry of toRemove) {
      // Check for attendance
      const { data: attendance } = await supabase
        .from('attendance')
        .select('id')
        .eq('calendar_entry_id', entry.id)
        .limit(1)

      if (attendance && attendance.length > 0) {
        keptCount++
        console.warn(`[SYNC] WARNING: Refused to delete ${entry.date} ${entry.class_code} because attendance exists!`)
        continue // DO NOT DELETE
      }

      // Safe to delete
      const { error: delError } = await supabase
        .from('calendar_entries')
        .delete()
        .eq('id', entry.id)
      
      if (!delError) deletedCount++
    }

    // 7. Safe Insertions
    if (toAdd.length > 0) {
      const { error: insError } = await supabase
        .from('calendar_entries')
        .insert(toAdd)
      
      if (!insError) insertedCount = toAdd.length
    }

    return NextResponse.json({
      success: true,
      message: 'Schedule Sync Completed',
      stats: {
        added: insertedCount,
        removed: deletedCount,
        refused_to_remove: keptCount,
        total_in_db_now: dbEntries.length + insertedCount - deletedCount
      }
    })

  } catch (error: any) {
    console.error('Sync error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
