'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import DateStrip from '@/components/DateStrip'
import ClassCard from '@/components/ClassCard'
import ProfileModal from '@/components/ProfileModal'

const TERM_START = '2026-06-12'
const TERM_END   = '2026-09-03'
const EXAM_START = '2026-08-23'
const INDEPENDENCE_DAY = '2026-08-15'

// Build all dates in the term
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
  is_holiday: boolean
  is_exam_period: boolean
  note: string | null
}

interface UserProfile {
  roll_no: string
  name: string
  email: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [entries, setEntries] = useState<ScheduleEntry[]>([])
  const [enrollments, setEnrollments] = useState<{course_abbr: string}[]>([])
  const [attendance, setAttendance] = useState<{calendar_entry_id: string, is_present: boolean}[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const todayDate = new Date().toISOString().split('T')[0]

  const supabase = createClient()

  const [showProfile, setShowProfile] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Parallelize fetching
      const [profRes, attRes] = await Promise.all([
        supabase.from('user_profiles').select('roll_no, name, email').eq('id', user.id).single(),
        fetch('/api/attendance').then(res => res.json())
      ])

      const prof = profRes.data
      if (!prof) {
        setLoading(false)
        return
      }

      setProfile(prof)
      if (attRes.attendance) setAttendance(attRes.attendance)

      // Fetch schedule (depends on roll_no)
      const res = await fetch(`/api/schedule?roll_no=${prof.roll_no}`)
      const data = await res.json()
      if (data.entries) setEntries(data.entries)
      if (data.enrollments) setEnrollments(data.enrollments)

      setLoading(false)

      const today = new Date().toISOString().split('T')[0]
      if (today >= TERM_START && today <= TERM_END) {
        setSelectedDate(today)
      } else {
        setSelectedDate(TERM_START)
      }
    }
    load()
  }, [])

  // Build date strip data
  const dateStripData = useMemo(() => ALL_DATES.map(date => {
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
  }), [entries])

  // Classes for selected date, sorted by time
  const TIME_ORDER = [
    '08:45-10:00','10:20-11:35','11:55-1:10',
    '14:30-15:45','16:05-17:20','17:40-18:55',
    '19:15-20:30','20:50-22:05','22:25-23:40'
  ]
  const dayClasses = useMemo(() => entries
    .filter(e => e.date === selectedDate)
    .sort((a, b) => TIME_ORDER.indexOf(a.time_slot) - TIME_ORDER.indexOf(b.time_slot))
  , [entries, selectedDate])

  const selectedDateObj = new Date(selectedDate + 'T00:00:00')
  const isSunday = selectedDateObj.getDay() === 0
  const isHoliday = selectedDate === INDEPENDENCE_DAY
  const isExam = selectedDate >= EXAM_START

  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']

  const displayDate = `${dayNames[selectedDateObj.getDay()]}, ${selectedDateObj.getDate()} ${monthNames[selectedDateObj.getMonth()]} ${selectedDateObj.getFullYear()}`

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading-full">
          <div className="spinner" />
          Loading your schedule…
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      {/* Mobile Header */}
      <header className="mobile-header">
        <div className="mobile-header-logo">
          <img src="/Logo.jpeg" alt="IIM Rohtak Logo" className="topbar-logo-img" />
          <span className="topbar-logo-name" style={{ marginLeft: '12px' }}>PC-V1 Portal</span>
        </div>
        <div className="mobile-header-right">
          {profile && (
            <div className="user-avatar" onClick={() => setShowProfile(true)} title="View Profile">
              {profile.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
            </div>
          )}
        </div>
      </header>

      {showProfile && profile && (
        <ProfileModal profile={profile} onClose={() => setShowProfile(false)} />
      )}

      {/* Main content */}
      <main className="page-content">
        <div className="page-header">
          <h1 className="page-title">
            PC-V1 Dashboard
            {profile && (
              <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 16, marginLeft: 12 }}>
                – Term IV (PGP 16)
              </span>
            )}
          </h1>
          <p className="page-subtitle">
            {profile
              ? `Showing schedule for ${profile.name} · Roll: ${profile.roll_no}`
              : 'Exclusive schedule for PC-V1 members'
            }
          </p>
          
            {enrollments.length > 0 && (
              <div className="enrolled-courses-strip">
                {enrollments.map((enrollment, idx) => (
                  <div key={idx} className="enrolled-badge">
                    <div className="enrolled-badge-icon" />
                    {enrollment.course_abbr}
                  </div>
                ))}
              </div>
            )}
            
            <div style={{ marginTop: '20px' }}>
              <button 
                onClick={() => router.push('/dashboard/attendance')}
                style={{
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                  padding: '12px 20px',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  boxShadow: 'var(--shadow-sm)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ background: 'var(--accent-primary)', color: 'white', padding: '6px', borderRadius: '6px', display: 'flex' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                  </div>
                  <span>View Course Attendance</span>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </button>
            </div>
          </div>

        {/* Date Strip */}
        <DateStrip
          dates={dateStripData}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          todayDate={todayDate}
        />

        {/* Schedule for selected date */}
        <div className="schedule-date-header">
          <div className="schedule-date-display">
            <span className="schedule-date-big">{selectedDateObj.getDate()} {monthNames[selectedDateObj.getMonth()]}</span>
            <span className="schedule-date-sub">{displayDate}</span>
          </div>
          {isSunday && <span className="schedule-badge schedule-badge-sunday">🌙 Sunday</span>}
          {isHoliday && <span className="schedule-badge schedule-badge-holiday">🇮🇳 Independence Day</span>}
          {isExam && !isHoliday && <span className="schedule-badge schedule-badge-exam">📝 End-Term Exam Period</span>}
        </div>

        {(isSunday || isHoliday || isExam) && dayClasses.length === 0 ? (
          <div className="no-classes">
            <div className="no-classes-icon">
              {isHoliday ? '🇮🇳' : isExam ? '📝' : '🌙'}
            </div>
            <div className="no-classes-text">
              {isHoliday ? 'Independence Day – No Classes' : isExam ? 'End-Term Exam Period' : 'No classes on Sunday'}
            </div>
            <div className="no-classes-sub">
              {isHoliday ? 'National holiday' : isExam ? 'Exams run from 23 Aug to 3 Sep 2026' : 'Enjoy your day off! 😊'}
            </div>
          </div>
        ) : dayClasses.length === 0 ? (
          <div className="no-classes">
            <div className="no-classes-icon">📭</div>
            <div className="no-classes-text">No classes scheduled</div>
            <div className="no-classes-sub">This date has no classes in your timetable.</div>
          </div>
        ) : (
          <div className="slots-grid">
            {dayClasses.map((cls, i) => {
              // Calculate attendance for this specific course
              const courseEntriesOccurred = entries.filter(e => 
                e.course_abbr === cls.course_abbr && 
                e.date <= todayDate &&
                !e.is_holiday && !e.is_exam_period
              )
              const totalClassesOccurred = courseEntriesOccurred.length
              
              let attendedClasses = 0
              let isPresent = false

              if (totalClassesOccurred > 0) {
                const occurredEntryIds = new Set(courseEntriesOccurred.map(e => (e as any).id))
                const userAttendedIds = new Set(attendance.filter(a => a.is_present).map(a => a.calendar_entry_id))
                
                attendedClasses = Array.from(occurredEntryIds).filter(id => userAttendedIds.has(id)).length
                isPresent = userAttendedIds.has((cls as any).id)
              }

              const isPast = cls.date <= todayDate

              const handleToggleAttendance = async (entryId: string, currentlyPresent: boolean) => {
                // Optimistic UI update
                const newAttendance = [...attendance]
                if (currentlyPresent) {
                  setAttendance(newAttendance.filter(a => a.calendar_entry_id !== entryId))
                } else {
                  newAttendance.push({ calendar_entry_id: entryId, is_present: true })
                  setAttendance(newAttendance)
                }

                // API call
                await fetch('/api/attendance', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ calendar_entry_id: entryId, action: currentlyPresent ? 'undo' : 'present' })
                })
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
                  attendedClasses={attendedClasses}
                  totalClassesOccurred={totalClassesOccurred}
                  entryId={(cls as any).id}
                  isPresent={isPresent}
                  isPast={isPast}
                  onToggleAttendance={handleToggleAttendance}
                />
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
