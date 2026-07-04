'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import DateStrip from '@/components/DateStrip'
import ClassCard from '@/components/ClassCard'

const TERM_START = '2026-06-12'
const TERM_END   = '2026-09-03'
const EXAM_START = '2026-08-23'
const INDEPENDENCE_DAY = '2026-08-15'
const MUHARRAM = '2026-06-26'

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

export default function DashboardSearch() {
  const [query, setQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchedStudentData[]>([])
  const [loadingSearch, setLoadingSearch] = useState<Record<string, boolean>>({})
  const [allStudents, setAllStudents] = useState<Student[]>([])
  
  const [searchMode, setSearchMode] = useState<'timetable' | 'spoc'>('timetable')
  const [spcQuery, setSpcQuery] = useState('')
  const [spcResults, setSpcResults] = useState<{roll_no: string, name: string, spoc_name: string, spoc_contact: string, spoc_email: string, batch?: string}[]>([])
  const [loadingSpc, setLoadingSpc] = useState(false)

  const todayDate = new Date().toISOString().split('T')[0]

  useEffect(() => {
    fetch('/api/students?q=all')
      .then(res => res.json())
      .then(data => setAllStudents(data.students || []))
  }, [])

  useEffect(() => {
    if (searchMode === 'spoc' && spcQuery.length >= 2) {
      setLoadingSpc(true)
      fetch(`/api/spocs?q=${encodeURIComponent(spcQuery)}`)
        .then(res => res.json())
        .then(data => {
          if (data.results) setSpcResults(data.results)
          setLoadingSpc(false)
        })
    } else if (searchMode === 'spoc') {
      setSpcResults([])
    }
  }, [searchMode, spcQuery])

  const suggestions = useMemo(() => {
    if (query.length < 2) return []
    const q = query.toLowerCase()
    return allStudents
      .filter(s => s.name.toLowerCase().includes(q) || s.roll_no.toLowerCase().includes(q))
      .slice(0, 15)
  }, [query, allStudents])

  useEffect(() => {
    if (query.length >= 2 && suggestions.length > 0) setShowDropdown(true)
    else if (query.length < 2) setShowDropdown(false)
  }, [query, suggestions.length])

  async function selectStudent(student: Student) {
    setShowDropdown(false)
    setQuery('')
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

  function removeStudent(roll_no: string) {
    setSearchResults(prev => prev.filter(r => r.student.roll_no !== roll_no))
  }

  function setStudentDate(roll_no: string, date: string) {
    setSearchResults(prev => prev.map(r =>
      r.student.roll_no === roll_no ? { ...r, selectedDate: date } : r
    ))
  }

  const filteredSpcs = spcResults

  const [isFocused, setIsFocused] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false)
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} style={{ marginBottom: '24px' }}>
      {isFocused && (
        <div style={{ display: 'flex', background: 'var(--bg-body)', borderRadius: '8px', padding: '4px', border: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
          <button 
            onClick={() => setSearchMode('timetable')}
            style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', fontSize: '13px', fontWeight: 600, transition: '0.2s', cursor: 'pointer',
              background: searchMode === 'timetable' ? 'var(--bg-card)' : 'transparent',
              color: searchMode === 'timetable' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: searchMode === 'timetable' ? 'var(--shadow-sm)' : 'none'
            }}
          >
            Student Timetable
          </button>
          <button 
            onClick={() => setSearchMode('spoc')}
            style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', fontSize: '13px', fontWeight: 600, transition: '0.2s', cursor: 'pointer',
              background: searchMode === 'spoc' ? 'var(--bg-card)' : 'transparent',
              color: searchMode === 'spoc' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: searchMode === 'spoc' ? 'var(--shadow-sm)' : 'none'
            }}
          >
            SPOC Directory
          </button>
        </div>
      )}

      <div className="search-box-wrapper" style={{ position: 'relative', marginBottom: searchMode === 'spoc' && isFocused ? '16px' : '0' }}>
        <span className="search-icon">🔍</span>
        <input
          type="text"
          className="search-input"
          placeholder={isFocused ? (searchMode === 'timetable' ? "Search student for timetable…" : "Filter SPOC by name…") : "Search directory…"}
          value={searchMode === 'timetable' ? query : spcQuery}
          onChange={e => {
            if (searchMode === 'timetable') setQuery(e.target.value)
            else setSpcQuery(e.target.value)
          }}
          onFocus={() => {
            setIsFocused(true)
            if (searchMode === 'timetable' && suggestions.length > 0) setShowDropdown(true)
          }}
          autoComplete="off"
        />
        {searchMode === 'timetable' && showDropdown && suggestions.length > 0 && (
          <div className="search-dropdown" style={{ zIndex: 99 }}>
            {suggestions.map(s => (
              <div key={s.roll_no} className="search-option" onMouseDown={() => selectStudent(s)}>
                <div className="search-option-avatar">{s.name.split(' ').map(w => w[0]).join('').slice(0, 2)}</div>
                <div className="search-option-info">
                  <span className="search-option-name">{s.name}</span>
                  <span className="search-option-roll">{s.roll_no}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {(searchMode === 'timetable' || !isFocused) && searchResults.length > 0 && (
        <div className="selected-students-chips" style={{ marginTop: '16px' }}>
          {searchResults.map(r => (
            <div key={r.student.roll_no} className="student-chip" onClick={() => removeStudent(r.student.roll_no)}>
              <div className="student-chip-avatar">{r.student.name.split(' ').map(w => w[0]).join('').slice(0, 2)}</div>
              <span className="student-chip-name">{r.student.name}</span>
              <div className="student-chip-remove">✕</div>
            </div>
          ))}
        </div>
      )}

      {(searchMode === 'timetable' || !isFocused) && searchResults.map(r => {
        const dateStripData = ALL_DATES.map(date => {
          const jsDate = new Date(date + 'T00:00:00')
          const isSunday = jsDate.getDay() === 0
          const isHoliday = date === INDEPENDENCE_DAY || date === MUHARRAM
          const isExamPeriod = date >= EXAM_START
          const classCount = r.entries.filter(e => e.date === date).length
          return {
            date, day_of_week: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][jsDate.getDay()],
            is_sunday: isSunday, is_holiday: isHoliday, is_exam_period: isExamPeriod, class_count: classCount
          }
        })
        const dayClasses = r.entries.filter(e => e.date === r.selectedDate).sort((a, b) => TIME_ORDER.indexOf(a.time_slot) - TIME_ORDER.indexOf(b.time_slot))
        return (
          <div key={r.student.roll_no} className="search-student-section" style={{ marginTop: '24px', background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontWeight: 800, fontSize: '16px', marginBottom: '16px' }}>{r.student.name}'s Schedule</div>
            <div style={{ margin: '0 -16px' }}>
              <DateStrip dates={dateStripData} selectedDate={r.selectedDate} onSelectDate={(date) => setStudentDate(r.student.roll_no, date)} todayDate={todayDate} />
            </div>
            {loadingSearch[r.student.roll_no] ? (
              <div className="loading-full"><div className="spinner"/>Loading…</div>
            ) : dayClasses.length === 0 ? (
              <div className="no-classes">
                <div className="no-classes-text">No classes scheduled</div>
              </div>
            ) : (
              <div className="slots-grid" style={{ marginTop: '16px' }}>
                {dayClasses.map((cls, i) => (
                  <ClassCard key={`${cls.date}-${cls.time_slot}-${cls.course_abbr}`} timeSlot={cls.time_slot} classCode={cls.class_code} courseAbbr={cls.course_abbr} courseFullName={cls.course_full_name} faculty={cls.faculty} facultyAbbr={cls.faculty_abbr} sessionNumber={cls.session_number} lr={cls.lr} section={cls.section} colorIndex={i} />
                ))}
              </div>
            )}
          </div>
        )
      })}

      {searchMode === 'spoc' && isFocused && (
        <div style={{ marginTop: '16px' }}>
          {loadingSpc ? (
            <div className="loading-full"><div className="spinner" />Searching directory...</div>
          ) : spcQuery.length < 2 ? (
            <div className="no-classes"><div className="no-classes-text">Type at least 2 characters to search for a student.</div></div>
          ) : filteredSpcs.length === 0 ? (
            <div className="no-classes"><div className="no-classes-text">No student found.</div></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
              {filteredSpcs.map(spc => (
                <div key={spc.roll_no} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', background: 'var(--bg-body)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0, border: '1px solid var(--border-subtle)' }}>
                      {spc.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{spc.name}</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{spc.roll_no} {spc.batch && `• ${spc.batch}`}</div>
                    </div>
                  </div>
                  
                  <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', padding: '12px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Assigned SPOC</div>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{spc.spoc_name}</div>
                      {spc.spoc_email && <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{spc.spoc_email}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {spc.spoc_contact && (
                        <a href={`tel:${spc.spoc_contact}`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-body)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', textDecoration: 'none', transition: '0.2s' }}>
                          📞
                        </a>
                      )}
                      {spc.spoc_email && (
                        <a href={`mailto:${spc.spoc_email}`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', background: 'var(--accent-primary)', color: 'white', textDecoration: 'none', transition: '0.2s', boxShadow: 'var(--shadow-sm)' }}>
                          ✉️
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
