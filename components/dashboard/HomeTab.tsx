'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import DateStrip from '@/components/DateStrip'
import ClassCard from '@/components/ClassCard'
import DashboardSearch from '@/components/dashboard/DashboardSearch'

const TERM_START = '2026-06-12'
const TERM_END   = '2026-09-03'
const EXAM_START = '2026-08-23'
const INDEPENDENCE_DAY = '2026-08-15'

function buildTermDates() {
  const dates: string[] = []
  const cur = new Date(TERM_START)
  const end = new Date(TERM_END)
  while (cur <= end) {
    dates.push(cur.toISOString().split('T')[0])
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

const ALL_DATES = buildTermDates()

interface ScheduleEntry {
  id?: string
  date: string
  time_slot: string
  class_code: string
  course_abbr: string
  course_full_name: string
  faculty: string
  faculty_abbr: string
  session_number: number
  lr: string
  section: string
  is_holiday?: boolean
  is_exam_period?: boolean
}

const TIME_ORDER = [
  '08:45-10:00','10:20-11:35','11:55-1:10',
  '14:30-15:45','16:05-17:20','17:40-18:55',
  '19:15-20:30','20:50-22:05','22:25-23:40'
]

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

export default function HomeTab() {
  const supabase = createClient()
  const todayDate = new Date().toISOString().split('T')[0]

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<{ name: string; roll_no: string; email: string } | null>(null)
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [entries, setEntries] = useState<ScheduleEntry[]>([])
  const [attendance, setAttendance] = useState<any[]>([])
  
  const [selectedDate, setSelectedDate] = useState<string>('')
  
  async function toggleAttendance(entryId: string, isCurrentlyPresent: boolean) {
    setAttendance(prev => {
      if (isCurrentlyPresent) return prev.filter(a => a.calendar_entry_id !== entryId)
      return [...prev, { calendar_entry_id: entryId, is_present: true }]
    })

    await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        calendar_entry_id: entryId,
        action: isCurrentlyPresent ? 'undo' : 'present'
      })
    })
  }

  // Real-time Next Class Countdown
  const [nextClassInfo, setNextClassInfo] = useState<{ course: string, time: string, lr: string, startsInMs: number } | null>(null)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: prof } = await supabase.from('user_profiles').select('name, roll_no, email').eq('id', user.id).single()
      if (prof) setProfile(prof)

      if (todayDate >= TERM_START && todayDate <= TERM_END) {
        setSelectedDate(todayDate)
      } else {
        setSelectedDate(TERM_START)
      }

      if (prof?.roll_no) {
        const { data: student } = await supabase.from('students').select('id').eq('roll_no', prof.roll_no).single()
        if (student) {
          const res = await fetch(`/api/schedule?roll_no=${prof.roll_no}`)
          const data = await res.json()
          if (data.entries) {
            setEntries(data.entries)
            setEnrollments(data.enrollments || [])
            setAttendance(data.attendance || [])
          }
        }
      }

      setLoading(false)
    }

    init()
  }, [])

  // Calculate Next Class
  useEffect(() => {
    if (entries.length === 0) return

    const now = new Date()
    let nextCls: any = null
    let minDiff = Infinity

    entries.forEach(cls => {
      const [startHour, startMin] = cls.time_slot.split('-')[0].split(':').map(Number)
      const classStart = new Date(`${cls.date}T${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}:00`)
      
      const diff = classStart.getTime() - now.getTime()
      if (diff > 0 && diff < minDiff) {
        minDiff = diff
        nextCls = cls
      }
    })

    if (nextCls) {
      setNextClassInfo({
        course: nextCls.course_full_name || nextCls.course_abbr,
        time: nextCls.time_slot.split('-')[0],
        lr: nextCls.lr,
        startsInMs: minDiff
      })
    } else {
      setNextClassInfo(null)
    }
  }, [entries])

  const dateStripData = ALL_DATES.map(date => {
    const jsDate = new Date(date + 'T00:00:00')
    const isSunday = jsDate.getDay() === 0
    const isHoliday = date === INDEPENDENCE_DAY
    const isExamPeriod = date >= EXAM_START
    const classCount = entries.filter(e => e.date === date).length

    return {
      date,
      day_of_week: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][jsDate.getDay()],
      is_sunday: isSunday,
      is_holiday: isHoliday,
      is_exam_period: isExamPeriod,
      holiday_name: isHoliday ? 'Independence Day' : undefined,
      class_count: classCount,
    }
  })

  const dayClasses = entries
    .filter(e => e.date === selectedDate)
    .sort((a, b) => TIME_ORDER.indexOf(a.time_slot) - TIME_ORDER.indexOf(b.time_slot))

  const selDate = new Date(selectedDate + 'T00:00:00')
  const isSunday = selDate.getDay() === 0
  const isHoliday = selectedDate === INDEPENDENCE_DAY
  const isExam = selectedDate >= EXAM_START

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading-full"><div className="spinner" />Loading schedule...</div>
      </div>
    )
  }

  const QUOTES = [
    "Let's crush these classes! 🚀",
    "Time to get that A! 📚",
    "Giddy up, brilliant mind! 🐎",
    "Another day, another case study! 💼",
    "Stay sharp, future leader! 🌟",
    "Coffee in hand, let's go! ☕",
    "Make today count! ⚡",
    "One step closer to graduation! 🎓",
    "Embrace the challenge! 💪"
  ]
  const todayIndex = Math.floor(new Date().getTime() / 86400000) % QUOTES.length
  const dailyQuote = QUOTES[todayIndex]

  return (
    <>
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <h1 className="page-title" style={{ fontSize: '26px' }}>
          Hello {profile?.name ? profile.name.split(' ')[0] : 'Student'},
        </h1>
        <div style={{ fontSize: '15px', color: 'var(--text-secondary)', marginTop: '4px', fontStyle: 'italic', fontWeight: 500 }}>
          {dailyQuote}
        </div>
      </div>

      <DashboardSearch />

      {nextClassInfo && nextClassInfo.startsInMs < 24 * 60 * 60 * 1000 && (
        <div style={{
          background: 'linear-gradient(135deg, var(--accent-primary) 0%, #059669 100%)',
          borderRadius: 'var(--radius-xl)', padding: '20px', color: 'white', marginBottom: '24px',
          boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.4)', position: 'relative', overflow: 'hidden'
        }}>
          <div style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', opacity: 0.9 }}>
            Next Class
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{nextClassInfo.course}</span>
          </div>
          <div style={{ display: 'flex', gap: '16px', fontSize: '14px', fontWeight: 500, opacity: 0.9 }}>
            <span>⏰ {nextClassInfo.time}</span>
            <span>📍 {nextClassInfo.lr}</span>
          </div>
        </div>
      )}

      {enrollments.length > 0 && (
        <div className="course-progress-strip">
          {enrollments.map((enrollment, idx) => {
            const courseEntriesOccurred = entries.filter(e => 
              e.course_abbr === enrollment.course_abbr && 
              e.date <= todayDate &&
              !e.is_holiday && !e.is_exam_period
            )
            const totalClassesOccurred = courseEntriesOccurred.length
            let attendedClasses = 0
            
            if (totalClassesOccurred > 0) {
              const occurredEntryIds = new Set(courseEntriesOccurred.map(e => (e as any).id))
              const userAttendedIds = new Set(attendance.filter(a => a.is_present).map(a => a.calendar_entry_id))
              attendedClasses = courseEntriesOccurred.filter(e => userAttendedIds.has((e as any).id)).length
            }

            const percentage = totalClassesOccurred > 0 ? Math.round((attendedClasses / totalClassesOccurred) * 100) : 100
            
            return (
              <div key={enrollment.course_abbr} className="course-progress-card">
                <div className="course-progress-header">
                  <span className="course-progress-abbr">{enrollment.course_abbr}</span>
                  <span className={`course-progress-pct ${percentage < 75 ? 'danger' : ''}`}>{percentage}%</span>
                </div>
                <div className="course-progress-bar-bg">
                  <div className={`course-progress-bar-fill ${percentage < 75 ? 'danger' : ''}`} style={{ width: `${percentage}%` }}></div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ margin: '0 -20px 24px -20px' }}>
        <DateStrip
          dates={dateStripData}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          todayDate={todayDate}
        />
      </div>

      <div className="schedule-date-header">
        <div className="schedule-date-display">
          <span className="schedule-date-big">{selDate.getDate()} {MONTH_NAMES[selDate.getMonth()]}</span>
          <span className="schedule-date-sub">
            {DAY_NAMES[selDate.getDay()]}, {selDate.getDate()} {MONTH_NAMES[selDate.getMonth()]} {selDate.getFullYear()}
          </span>
        </div>
        {isSunday && <span className="schedule-badge schedule-badge-sunday">🌙 Sunday</span>}
        {isHoliday && <span className="schedule-badge schedule-badge-holiday">🇮🇳 Independence Day</span>}
        {isExam && !isHoliday && <span className="schedule-badge schedule-badge-exam">📝 End-Term Exams</span>}
      </div>

      {dayClasses.length === 0 ? (
        <div className="no-classes">
          <div className="no-classes-icon">{isHoliday ? '🇮🇳' : isExam ? '📝' : isSunday ? '🌙' : '📭'}</div>
          <div className="no-classes-text">
            {isHoliday ? 'Independence Day – No Classes' : isExam ? 'End-Term Exam Period' : isSunday ? 'No classes on Sunday' : 'No classes scheduled'}
          </div>
          {!isHoliday && !isExam && !isSunday && (
            <div className="no-classes-sub">Enjoy your free day! 🎉</div>
          )}
        </div>
      ) : (
        <div className="slots-grid">
          {dayClasses.map((cls, i) => {
            const entryId = cls.id
            const isPresent = attendance.some(a => a.calendar_entry_id === entryId && a.is_present)
            
            let isPast = false
            if (selectedDate < todayDate) isPast = true
            else if (selectedDate === todayDate) {
              const endTimeStr = cls.time_slot.split('-')[1]
              if (endTimeStr) {
                const now = new Date()
                const [endH, endM] = endTimeStr.split(':').map(Number)
                const endDateTime = new Date()
                endDateTime.setHours(endH, endM, 0, 0)
                if (now > endDateTime) isPast = true
              }
            }

            return (
              <ClassCard
                key={`${cls.date}-${cls.time_slot}-${cls.course_abbr}`}
                timeSlot={cls.time_slot}
                classCode={cls.class_code}
                courseAbbr={cls.course_abbr}
                courseFullName={cls.course_full_name}
                faculty={cls.faculty}
                facultyAbbr={cls.faculty_abbr}
                sessionNumber={cls.session_number}
                lr={cls.lr}
                section={cls.section}
                colorIndex={i}
                entryId={entryId}
                isPresent={isPresent}
                isPast={isPast}
                onToggleAttendance={toggleAttendance}
              />
            )
          })}
        </div>
      )}
    </>
  )
}
