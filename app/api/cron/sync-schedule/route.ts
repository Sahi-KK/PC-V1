import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Papa from 'papaparse'

// Initialize Supabase service role client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Use sheet name param to always target the correct tab "PGPO Term IV"
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1bnjl5IXxER0pWvxG75TswZyMxm7Gxk4S4UCUxQKikzc/export?format=csv&sheet=PGPO+Term+IV'
const REAL_HOLIDAYS = new Set(['2026-06-26', '2026-08-15'])
const EXAM_START = '2026-08-23'

const DAY_NAMES: Record<number, string> = {
  0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 
  4: 'Thursday', 5: 'Friday', 6: 'Saturday'
}

// Column index → time slot label (col 5 is LUNCH, skip it)
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

function parseCell(val: string): { course_abbr: string, session_number: number, faculty_abbr: string } | null {
  if (!val) return null
  val = val.trim()
  if (!val) return null
  
  // Skip non-class values
  const upper = val.toUpperCase()
  if (['LUNCH', 'SUNDAY', 'NAN'].includes(upper)) return null
  if (val.includes('End Term') || val.startsWith('Term') || val.startsWith('Section')) return null
  
  // Extract faculty abbreviation from parentheses (handles missing closing paren)
  const parenMatch = val.match(/\(([^)]+)\)?$/)
  if (!parenMatch) return null
  const faculty_abbr = parenMatch[1].trim()
  
  // Remove the (faculty) part
  const withoutFaculty = val.replace(/\s*\([^)]+\)?$/, '').trim()
  
  // Find the last number in the remaining string — that's the session number
  // This correctly handles: "L&D 1", "Ind 4.0 1", "CW- 1", "IBS7", "BA 1", "MBPET 14"
  const lastNumMatch = withoutFaculty.match(/^(.*?)(\d+)\s*$/)
  if (!lastNumMatch) return null
  
  const course_abbr = lastNumMatch[1].trim()
  const session_number = parseInt(lastNumMatch[2])
  
  if (!course_abbr || course_abbr.length === 0) return null
  if (isNaN(session_number) || session_number <= 0) return null
  
  return { course_abbr, session_number, faculty_abbr }
}

// Parse dates like "12-Jun-26", "12-Jun-2026"
function parseSheetDate(val: string): string | null {
  if (!val || !val.trim()) return null
  const v = val.trim()
  
  // Try "D-Mon-YY" or "D-Mon-YYYY" format first
  const match = v.match(/^(\d{1,2})-([A-Za-z]{3,})-(\d{2,4})$/)
  if (match) {
    const year = parseInt(match[3])
    const fullYear = year < 100 ? 2000 + year : year
    const d = new Date(`${match[2]} ${match[1]}, ${fullYear}`)
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0]
    }
  }
  
  // Fallback to direct JS parse
  const d2 = new Date(v)
  if (!isNaN(d2.getTime())) {
    return d2.toISOString().split('T')[0]
  }
  
  return null
}

export async function GET(request: Request) {
  try {
    // 1. Fetch live CSV from the correct "PGPO Term IV" tab
    const response = await fetch(SHEET_URL, { cache: 'no-store' })
    if (!response.ok) throw new Error(`Failed to fetch Google Sheet: ${response.status}`)
    const csvText = await response.text()
    
    // 2. Parse CSV (do NOT skip empty lines — needed to preserve row structure)
    const { data: rows } = Papa.parse<string[]>(csvText, { skipEmptyLines: false })
    
    const groundTruth: Record<string, any> = {}
    let currentDate: string | null = null
    
    // 3. Extract Schedule
    // Header structure:
    //   Row 0: Section labels
    //   Row 1: Second header row  
    //   Row 2: Time slot labels (,Section,08:45-10:00,...)
    //   Row 3+: Data rows
    //
    // Data row format:
    //   col[0] = date (e.g., "12-Jun-26") on first section row, OR day name (e.g., "Friday") OR empty
    //   col[1] = section (A/B/C/D) OR holiday name
    //   col[2..11] = class cells
    
    for (let idx = 3; idx < rows.length; idx++) {
      const row = rows[idx]
      if (!row || row.length < 2) continue
      
      const col0 = row[0]?.trim() || ''
      const col1 = row[1]?.trim() || ''
      
      // Try to parse date from col0
      if (col0) {
        const parsed = parseSheetDate(col0)
        if (parsed) {
          currentDate = parsed
        } else if (col0.toLowerCase().includes('end term') || col0.toLowerCase().includes('exam')) {
          break // Stop at end of term
        }
        // If col0 is a day name ("Friday", "Saturday") — just a sub-row, keep currentDate
      }
      
      if (!currentDate) continue
      
      // Must be a valid section row
      if (!['A', 'B', 'C', 'D'].includes(col1)) continue
      const sect = col1
      
      for (const [colIdxStr, timeSlot] of Object.entries(TIME_SLOTS)) {
        const colIdx = parseInt(colIdxStr)
        const cellValue = row[colIdx]
        if (!cellValue || !cellValue.trim()) continue
        
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

    // 6. Safe Deletions (NEVER delete if attendance exists)
    for (const entry of toRemove) {
      const { data: attendance } = await supabase
        .from('attendance')
        .select('id')
        .eq('calendar_entry_id', entry.id)
        .limit(1)

      if (attendance && attendance.length > 0) {
        keptCount++
        console.warn(`[SYNC] Refused to delete ${entry.date} ${entry.class_code} — attendance exists!`)
        continue
      }

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
      else console.error('[SYNC] Insert error:', insError)
    }

    return NextResponse.json({
      success: true,
      message: 'Schedule Sync Completed',
      debug: {
        parsed_from_sheet: Object.keys(groundTruth).length,
        in_db_before: dbEntries.length,
        sample_keys: Object.keys(groundTruth).slice(0, 8)
      },
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


