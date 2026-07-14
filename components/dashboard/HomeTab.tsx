'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import DateStrip from '@/components/DateStrip'
import ClassCard from '@/components/ClassCard'
import DashboardSearch from '@/components/dashboard/DashboardSearch'

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

const MESS_MENU = {
  Sunday: {
    Breakfast: "Chocos, Banana, Bhurji, Dosa, Aaloo masala + Chutney + Sambhar",
    Lunch: "Toor Dal, Matar Paneer, Choco Icecream, Veg/Chicken Biryani, Raita",
    Snacks: "Samosa, Imli Chutney + Mint Chutney",
    Dinner: "Dal Makhani, Tori Chana/Aaloo, Plain Rice, Roti, Salad, Gulab Jamun"
  },
  Monday: {
    Breakfast: "Cornflakes, Papaya, Bhurji, Uttapam, Sambhar + Chutney",
    Lunch: "Kadhi Pakoda, Aaloo Jeera, Jeera Rice, Cucumber Raita, Roti",
    Snacks: "Bread Pakoda, Ketchup + Mint Chutney",
    Dinner: "Masoor Dal, Chicken Do Pyaza, Paneer Lababdar, Tawa Pulao, Custard"
  },
  Tuesday: {
    Breakfast: "Chocos, Fruit Chat, Boiled eggs, Paratha, Matar Sabzi",
    Lunch: "Daal Tadka, Aaloo Matar Sabzi, Jeera Rice, Plain Dahi, Methi Puri",
    Snacks: "Chowmein/Maggi, Ketchup",
    Dinner: "Urad Dal, Aaloo Palwal, Jeera Rice, Roti, Besan Barfi/Boondi"
  },
  Wednesday: {
    Breakfast: "Cornflakes, Banana, Masala Omelette, Idli, Sambhar + Chutney",
    Lunch: "Arhar Dal, Chicken Chilly, Veg Manchurian, Fried Rice, Pineapple Raita",
    Snacks: "Bhel Puri, Ketchup + Mint Chutney",
    Dinner: "Daal Palak, Lauki Kofta, Plain Rice, Roti, Jalebi"
  },
  Thursday: {
    Breakfast: "Cornflakes, Papaya, Bhurji, Aaloo Pyaz Paratha, Curd + Pickle",
    Lunch: "Amritsari Chole, Plain Rice, Chaach, Bhature",
    Snacks: "Aaloo Pakode, Ketchup + Mint Chutney",
    Dinner: "Lehsuni Dal, Gatte ki Sabzi, Matar Pulao, Roti, Ice Cream"
  },
  Friday: {
    Breakfast: "Cornflakes, Fruit Chat, Masala Omelette, Medu Vada, Sambhar",
    Lunch: "Mixed Dal, Dum Aaloo, Plain Rice, Boondi Raita, Roti",
    Snacks: "Pav Bhaji/Vada Pav, Lemon/Ketchup+Mint Chutney",
    Dinner: "Masoor Dal, Chicken Do Pyaza, Paneer Lababdar, Plain Rice, Kheer"
  },
  Saturday: {
    Breakfast: "Chocos, Papaya, Boiled eggs, Aaloo Pyaaz Paratha, Matar Sabzi",
    Lunch: "Rajma, Lauki, Plain Rice, Dahi vada, Roti",
    Snacks: "Pasta, Ketchup",
    Dinner: "Urad Dal, Cabbage matar Aaloo, Jeera Rice, Roti, Halwa"
  }
}

const FOOD_ICONS = {
  Breakfast: '🌅',
  Lunch: '🍲',
  Snacks: '🍟',
  Dinner: '🍛'
}

function MessMenuWidget({ dateStr, isToday }: { dateStr: string, isToday: boolean }) {
  const jsDate = new Date(dateStr + 'T00:00:00')
  const dayName = DAY_NAMES[jsDate.getDay()] as keyof typeof MESS_MENU
  const menu = MESS_MENU[dayName]
  
  if (!menu) return null

  return (
    <div style={{
      background: 'var(--bg-surface)',
      borderRadius: 'var(--radius-xl)', padding: '24px', 
      boxShadow: 'var(--shadow-card)', border: '1px solid var(--border-subtle)',
      position: 'relative',
      display: 'flex', flexDirection: 'column', height: '100%'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
          <span style={{ fontSize: '16px' }}>🍽️</span> {isToday ? "Today's Menu" : `${dayName}'s Menu`}
        </h3>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-subtle)', padding: '4px 8px', borderRadius: '100px' }}>
          Scroll <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </div>
      </div>
      <div style={{ 
        display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px', margin: '0 -4px', padding: '0 4px 8px 4px',
        scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch', flex: 1
      }}>
        {(['Breakfast', 'Lunch', 'Snacks', 'Dinner'] as const).map(meal => (
          <div key={meal} style={{ 
            background: 'var(--bg-subtle)', padding: '12px 16px', borderRadius: 'var(--radius-lg)', 
            border: '1px solid var(--border-subtle)', minWidth: '200px', flex: '0 0 auto',
            display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '16px' }}>{FOOD_ICONS[meal]}</span> {meal}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, fontWeight: 500, whiteSpace: 'normal' }}>
              {menu[meal]}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function HomeTab() {
  const router = useRouter()
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
      const newAttendance = isCurrentlyPresent 
        ? prev.filter(a => a.calendar_entry_id !== entryId)
        : [...prev, { calendar_entry_id: entryId, is_present: true }]
      
      try {
        const cached = localStorage.getItem('pc_v1_schedule_cache')
        if (cached) {
          const parsed = JSON.parse(cached)
          parsed.attendance = newAttendance
          localStorage.setItem('pc_v1_schedule_cache', JSON.stringify(parsed))
        }
      } catch (e) {}

      return newAttendance
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
      try {
        const cached = localStorage.getItem('pc_v1_schedule_cache')
        if (cached) {
          const parsed = JSON.parse(cached)
          if (parsed.profile) setProfile(parsed.profile)
          if (parsed.entries) setEntries(parsed.entries)
          if (parsed.enrollments) setEnrollments(parsed.enrollments)
          if (parsed.attendance) setAttendance(parsed.attendance)
          setLoading(false)
        }
      } catch (e) {}

      if (todayDate >= TERM_START && todayDate <= TERM_END) {
        setSelectedDate(todayDate)
      } else {
        setSelectedDate(TERM_START)
      }

      try {
        const res = await fetch(`/api/schedule`)
        if (res.status === 401) return
        
        const data = await res.json()
        if (data.profile) setProfile(data.profile)
        if (data.entries) setEntries(data.entries)
        if (data.enrollments) setEnrollments(data.enrollments)
        if (data.attendance) setAttendance(data.attendance)
        
        localStorage.setItem('pc_v1_schedule_cache', JSON.stringify({
          profile: data.profile,
          entries: data.entries || [],
          enrollments: data.enrollments || [],
          attendance: data.attendance || []
        }))
      } catch (e) {}

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
    const isHoliday = date === INDEPENDENCE_DAY || date === MUHARRAM
    const isExamPeriod = date >= EXAM_START
    const classCount = entries.filter(e => e.date === date).length

    return {
      date,
      day_of_week: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][jsDate.getDay()],
      is_sunday: isSunday,
      is_holiday: isHoliday,
      is_exam_period: isExamPeriod,
      holiday_name: date === INDEPENDENCE_DAY ? 'Independence Day' : date === MUHARRAM ? 'Muharram' : undefined,
      class_count: classCount,
    }
  })

  const dayClasses = entries
    .filter(e => e.date === selectedDate)
    .sort((a, b) => TIME_ORDER.indexOf(a.time_slot) - TIME_ORDER.indexOf(b.time_slot))

  const selDate = new Date(selectedDate + 'T00:00:00')
  const isSunday = selDate.getDay() === 0
  const isHoliday = selectedDate === INDEPENDENCE_DAY || selectedDate === MUHARRAM
  const holidayName = selectedDate === INDEPENDENCE_DAY ? 'Independence Day' : selectedDate === MUHARRAM ? 'Muharram' : ''
  const isExam = selectedDate >= EXAM_START

  if (loading) {
    return (
      <div style={{ padding: '0', animation: 'fadeIn 0.3s ease-out' }}>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'hidden', paddingBottom: '16px', marginBottom: '24px' }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ minWidth: '100px', height: '140px', borderRadius: '16px' }} />)}
        </div>
        <div className="skeleton" style={{ height: '32px', width: '200px', marginBottom: '16px', borderRadius: '8px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: '120px', borderRadius: '20px' }} />)}
        </div>
      </div>
    )
  }

  return (
    <>
      <DashboardSearch />

      {enrollments.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', padding: '0 4px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>Attendance Overview</h2>
            <button 
              onClick={() => router.push('/dashboard/attendance')}
              style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-primary)', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              See all &rarr;
            </button>
          </div>
          
          <div className="enrolled-courses-strip" style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '8px' }}>
            {enrollments.map((enrollment, idx) => {
              const courseEntriesOccurred = entries.filter(e => 
                e.course_abbr === enrollment.course_abbr && 
                e.date <= todayDate &&
                !e.is_holiday && !e.is_exam_period
              )
              const totalClassesOccurred = courseEntriesOccurred.length
              let attendedClasses = 0
              
              if (totalClassesOccurred > 0) {
                const userAttendedIds = new Set(attendance.filter(a => a.is_present).map(a => a.calendar_entry_id))
                attendedClasses = courseEntriesOccurred.filter(e => userAttendedIds.has((e as any).id)).length
              }

              const percentage = totalClassesOccurred > 0 ? Math.round((attendedClasses / totalClassesOccurred) * 100) : 100
              const isDanger = percentage < 75
              const color = isDanger ? '#ef4444' : '#10b981'
              const radius = 22
              const circumference = 2 * Math.PI * radius
              const offset = circumference - (percentage / 100) * circumference

              return (
                <div 
                  key={enrollment.course_abbr} 
                  onClick={() => router.push(`/dashboard/attendance/${enrollment.course_abbr}`)}
                  style={{
                    background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 16px',
                    minWidth: '130px',
                    boxShadow: 'var(--shadow-card)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    cursor: 'pointer',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <div style={{ position: 'relative', width: '60px', height: '60px', marginBottom: '8px' }}>
                    <svg width="60" height="60" viewBox="0 0 60 60">
                      <circle cx="30" cy="30" r={radius} fill="none" stroke="var(--border-subtle)" strokeWidth="6" />
                      <circle 
                        cx="30" cy="30" r={radius} 
                        fill="none" 
                        stroke={color} 
                        strokeWidth="6" 
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 0.5s ease' }}
                      />
                    </svg>
                    <div style={{
                      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '14px', fontWeight: 700, color: color
                    }}>
                      {percentage}%
                    </div>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {enrollment.course_abbr}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        {nextClassInfo && nextClassInfo.startsInMs < 24 * 60 * 60 * 1000 && (
          <div style={{
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-xl)', padding: '24px',
            boxShadow: 'var(--shadow-card)', position: 'relative', overflow: 'hidden',
            border: '1px solid var(--border-subtle)',
            display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center'
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '6px', background: 'var(--gradient-primary)' }} />
            <div style={{ paddingLeft: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-primary)', marginBottom: '8px' }}>
                Next Class
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                {nextClassInfo.course}
              </div>
              <div style={{ display: 'flex', gap: '16px', fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  {nextClassInfo.time}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                  {nextClassInfo.lr}
                </span>
              </div>
            </div>
          </div>
        )}
        <MessMenuWidget dateStr={selectedDate} isToday={selectedDate === todayDate} />
      </div>

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
      </div>

      {dayClasses.length === 0 ? (
        <div className="no-classes">
          <div className="no-classes-text" style={{ fontSize: '16px', fontWeight: 600 }}>
            {isHoliday ? `${holidayName} – No Classes` : isExam ? 'End-Term Exam Period' : isSunday ? 'No classes on Sunday' : 'No classes scheduled'}
          </div>
          {!isHoliday && !isExam && !isSunday && (
            <div className="no-classes-sub" style={{ marginTop: '8px' }}>Enjoy your free day!</div>
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
