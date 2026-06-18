'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import DateStrip from '@/components/DateStrip'
import ClassCard from '@/components/ClassCard'

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
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const todayDate = new Date().toISOString().split('T')[0]

  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Get user profile
      const { data: prof } = await supabase
        .from('user_profiles')
        .select('roll_no, name, email')
        .eq('id', user.id)
        .single()

      if (!prof) {
        // Profile missing → redirect to re-register or show error
        setLoading(false)
        return
      }

      setProfile(prof)

      // Fetch schedule
      const res = await fetch(`/api/schedule?roll_no=${prof.roll_no}`)
      const data = await res.json()
      if (data.entries) {
        setEntries(data.entries)
      }

      setLoading(false)

      // Set selected date to today if in term, otherwise first day
      const today = new Date().toISOString().split('T')[0]
      if (today >= TERM_START && today <= TERM_END) {
        setSelectedDate(today)
      } else {
        setSelectedDate(TERM_START)
      }
    }
    load()
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // Build date strip data
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

  // Classes for selected date, sorted by time
  const TIME_ORDER = [
    '08:45-10:00','10:20-11:35','11:55-1:10',
    '14:30-15:45','16:05-17:20','17:40-18:55',
    '19:15-20:30','20:50-22:05','22:25-23:40'
  ]
  const dayClasses = entries
    .filter(e => e.date === selectedDate)
    .sort((a, b) => TIME_ORDER.indexOf(a.time_slot) - TIME_ORDER.indexOf(b.time_slot))

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
      {/* Topbar */}
      <header className="topbar">
        <div className="topbar-left">
          <div className="topbar-logo">
            <div className="topbar-logo-icon">🎓</div>
            <span className="topbar-logo-name">IIM Rohtak</span>
          </div>
          <div className="topbar-divider" />
          <div className="tabs">
            <button className="tab active" id="tab-calendar">
              <span className="tab-icon">📅</span> My Calendar
            </button>
            <button
              className="tab"
              id="tab-search"
              onClick={() => router.push('/dashboard/search')}
            >
              <span className="tab-icon">🔍</span> Search Schedule
            </button>
          </div>
        </div>

        <div className="topbar-right">
          {profile && (
            <div className="user-chip">
              <div className="user-avatar">
                {profile.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
              </div>
              <span>{profile.name}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                {profile.roll_no}
              </span>
            </div>
          )}
          <button className="btn-signout" onClick={handleSignOut} id="signout-btn">
            Sign out
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="page-content">
        <div className="page-header">
          <h1 className="page-title">
            My Calendar
            {profile && (
              <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 16, marginLeft: 12 }}>
                – Term IV (PGP 16)
              </span>
            )}
          </h1>
          <p className="page-subtitle">
            {profile
              ? `Showing schedule for ${profile.name} · Roll: ${profile.roll_no}`
              : 'Academic schedule for the current term'
            }
          </p>
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
            {dayClasses.map((cls, i) => (
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
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
