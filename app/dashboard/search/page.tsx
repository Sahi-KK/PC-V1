'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import DateStrip from '@/components/DateStrip'
import ClassCard from '@/components/ClassCard'
import ProfileModal from '@/components/ProfileModal'

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

interface Student { id: string; roll_no: string; name: string }
interface ScheduleEntry {
  date: string; time_slot: string; class_code: string;
  course_abbr: string; course_full_name: string; faculty: string;
  faculty_abbr: string; session_number: number; lr: string; section: string;
}

interface SearchedStudentData {
  student: Student
  entries: ScheduleEntry[]
  selectedDate: string
}

const TIME_ORDER = [
  '08:45-10:00','10:20-11:35','11:55-1:10',
  '14:30-15:45','16:05-17:20','17:40-18:55',
  '19:15-20:30','20:50-22:05','22:25-23:40'
]

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

export default function SearchPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Student[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchedStudentData[]>([])
  const [loadingSearch, setLoadingSearch] = useState<Record<string, boolean>>({})
  const [profile, setProfile] = useState<{ name: string; roll_no: string; email: string } | null>(null)
  const [showProfile, setShowProfile] = useState(false)
  const [allStudents, setAllStudents] = useState<Student[]>([])
  
  const [aiInput, setAiInput] = useState('')
  const [aiResponse, setAiResponse] = useState('')
  const [isAiLoading, setIsAiLoading] = useState(false)
  
  const searchRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const searchCache = useRef<Record<string, Student[]>>({})
  const todayDate = new Date().toISOString().split('T')[0]

  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      supabase.from('user_profiles').select('name,roll_no,email').eq('id', user.id).single()
        .then(({ data }) => { if (data) setProfile(data) })
    })

    fetch('/api/students?q=all')
      .then(res => res.json())
      .then(data => setAllStudents(data.students || []))

    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounced search suggestions
  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (query.length < 2) { setSuggestions([]); setShowDropdown(false); return }
    
    const cacheKey = query.toLowerCase()
    if (searchCache.current[cacheKey]) {
      setSuggestions(searchCache.current[cacheKey])
      setShowDropdown(true)
      return
    }

    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/students?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      const results = data.students || []
      searchCache.current[cacheKey] = results
      setSuggestions(results)
      setShowDropdown(true)
    }, 250)
  }, [query])

  async function selectStudent(student: Student) {
    setShowDropdown(false)
    setQuery('')
    // Avoid duplicates
    if (searchResults.some(r => r.student.roll_no === student.roll_no)) return

    setLoadingSearch(prev => ({ ...prev, [student.roll_no]: true }))

    const res = await fetch(`/api/schedule?roll_no=${student.roll_no}`)
    const data = await res.json()

    const initialDate = todayDate >= TERM_START && todayDate <= TERM_END ? todayDate : TERM_START

    setSearchResults(prev => [...prev, {
      student,
      entries: data.entries || [],
      selectedDate: initialDate,
    }])
    setLoadingSearch(prev => ({ ...prev, [student.roll_no]: false }))
  }

  async function removeStudent(roll_no: string) {
    setSearchResults(prev => prev.filter(r => r.student.roll_no !== roll_no))
  }

  async function handleAiSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!aiInput.trim()) return
    setIsAiLoading(true)
    setAiResponse('')
    
    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiInput })
      })
      const data = await res.json()
      setAiResponse(data.reply || 'Something went wrong.')
    } catch (err) {
      setAiResponse('Failed to connect to AI Assistant.')
    }
    setIsAiLoading(false)
  }

  function setStudentDate(roll_no: string, date: string) {
    setSearchResults(prev => prev.map(r =>
      r.student.roll_no === roll_no ? { ...r, selectedDate: date } : r
    ))
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

      <main className="page-content">
        <div className="page-header">
          <h1 className="page-title">Search Schedule</h1>
          <p className="page-subtitle">Search any student by name or roll number to view their timetable</p>
        </div>

        {/* Search box */}
        <div className="search-box-wrapper" ref={searchRef}>
          <span className="search-icon">🔍</span>
          <input
            id="student-search-input"
            type="text"
            className="search-input"
            placeholder="Search by student name or roll number…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
            autoComplete="off"
          />

          {showDropdown && suggestions.length > 0 && (
            <div className="search-dropdown">
              {suggestions.map(s => (
                <div
                  key={s.roll_no}
                  className="search-option"
                  onMouseDown={() => selectStudent(s)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="search-option-avatar">
                    {s.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                  </div>
                  <div className="search-option-info">
                    <span className="search-option-name">{s.name}</span>
                    <span className="search-option-roll">{s.roll_no}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {showDropdown && suggestions.length === 0 && query.length >= 2 && (
            <div className="search-dropdown">
              <div className="search-option" style={{ color: 'var(--text-muted)', cursor: 'default' }}>
                No students found for "{query}"
              </div>
            </div>
          )}
        </div>

        {/* AI Assistant */}
        <div className="ai-assistant-wrapper">
          <h2 className="ai-assistant-title">✨ AI Scheduling Assistant</h2>
          <form className="ai-chat-form" onSubmit={handleAiSubmit}>
            <input
              type="text"
              className="ai-chat-input"
              placeholder="Ask: Does Krishna have free slots on Aug 15?"
              value={aiInput}
              onChange={e => setAiInput(e.target.value)}
              disabled={isAiLoading}
            />
            <button type="submit" className="ai-chat-button" disabled={isAiLoading || !aiInput.trim()}>
              {isAiLoading ? '...' : 'Ask'}
            </button>
          </form>
          {aiResponse && (
            <div className="ai-response-box">
              <div className="ai-response-text">{aiResponse}</div>
            </div>
          )}
        </div>

        {/* All Students Directory */}
        {query === '' && allStudents.length > 0 && (
          <div className="student-directory">
            <h3 className="student-directory-title">All Students Directory</h3>
            <div className="student-directory-grid scrollable-directory">
              {allStudents.slice(0, 100).map(s => (
                <div 
                  key={s.roll_no} 
                  className="student-directory-card"
                  onClick={() => selectStudent(s)}
                >
                  <div className="student-directory-avatar">
                    {s.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                  </div>
                  <div className="student-directory-info">
                    <span className="student-directory-name">{s.name}</span>
                    <span className="student-directory-roll">{s.roll_no}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Selected student chips */}
        {searchResults.length > 0 && (
          <div className="selected-students-chips">
            {searchResults.map(r => (
              <div
                key={r.student.roll_no}
                className="student-chip"
                onClick={() => removeStudent(r.student.roll_no)}
                title="Click to remove"
              >
                <div className="student-chip-avatar">
                  {r.student.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                </div>
                <span className="student-chip-name">{r.student.name}</span>
                <span className="student-chip-roll">{r.student.roll_no}</span>
                <div className="student-chip-remove">✕</div>
              </div>
            ))}
          </div>
        )}

        {/* Per-student schedule sections */}
        {searchResults.map(r => {
          const dateStripData = ALL_DATES.map(date => {
            const jsDate = new Date(date + 'T00:00:00')
            const isSunday = jsDate.getDay() === 0
            const isHoliday = date === INDEPENDENCE_DAY
            const isExamPeriod = date >= EXAM_START
            const classCount = r.entries.filter(e => e.date === date).length
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

          const dayClasses = r.entries
            .filter(e => e.date === r.selectedDate)
            .sort((a, b) => TIME_ORDER.indexOf(a.time_slot) - TIME_ORDER.indexOf(b.time_slot))

          const selDate = new Date(r.selectedDate + 'T00:00:00')
          const isSunday = selDate.getDay() === 0
          const isHoliday = r.selectedDate === INDEPENDENCE_DAY
          const isExam = r.selectedDate >= EXAM_START

          return (
            <div key={r.student.roll_no} className="search-student-section">
              {/* Student header */}
              <div className="search-student-header">
                <div className="search-student-avatar-lg">
                  {r.student.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                </div>
                <div className="search-student-info">
                  <div className="name">{r.student.name}</div>
                  <div className="roll">{r.student.roll_no}</div>
                </div>
                <button
                  onClick={() => removeStudent(r.student.roll_no)}
                  style={{
                    marginLeft: 'auto', background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.2)', color: '#f87171',
                    borderRadius: '6px', padding: '5px 10px', cursor: 'pointer',
                    fontSize: '12px', fontWeight: 600
                  }}
                >
                  Remove
                </button>
              </div>

              {/* Date strip for this student */}
              <DateStrip
                dates={dateStripData}
                selectedDate={r.selectedDate}
                onSelectDate={(date) => setStudentDate(r.student.roll_no, date)}
                todayDate={todayDate}
              />

              {/* Selected date info */}
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

              {loadingSearch[r.student.roll_no] ? (
                <div className="loading-full"><div className="spinner" />Loading…</div>
              ) : dayClasses.length === 0 ? (
                <div className="no-classes">
                  <div className="no-classes-icon">{isHoliday ? '🇮🇳' : isExam ? '📝' : isSunday ? '🌙' : '📭'}</div>
                  <div className="no-classes-text">
                    {isHoliday ? 'Independence Day – No Classes' : isExam ? 'End-Term Exam Period' : isSunday ? 'No classes on Sunday' : 'No classes scheduled'}
                  </div>
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
            </div>
          )
        })}

        {searchResults.length === 0 && (
          <div className="no-classes" style={{ marginTop: 40 }}>
            <div className="no-classes-icon">👥</div>
            <div className="no-classes-text">Search for a student to view their schedule</div>
            <div className="no-classes-sub">Type at least 2 characters to see suggestions</div>
          </div>
        )}
      </main>
    </div>
  )
}
