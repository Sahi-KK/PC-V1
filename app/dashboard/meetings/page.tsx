'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DateStrip from '@/components/DateStrip'

const TERM_START = '2026-06-12'
const TERM_END   = '2026-09-03'
const EXAM_START = '2026-08-23'
const INDEPENDENCE_DAY = '2026-08-15'
const MUHARRAM = '2026-06-26'

function formatTime12Hour(timeStr: string) {
  if (timeStr === 'LUNCH') return 'Lunch'
  const [start, end] = timeStr.split('-')
  const format = (t: string) => {
    let [h, m] = t.split(':')
    let hNum = parseInt(h, 10)
    let ampm = hNum >= 12 ? 'PM' : 'AM'
    hNum = hNum % 12 || 12
    return `${hNum}:${m} ${ampm}`
  }
  return `${format(start)} - ${format(end)}`
}

function buildTermDates() {
  const dates: string[] = []
  // Use UTC noon to avoid any timezone day-shift issues
  const cur = new Date(Date.UTC(2026, 5, 12, 12, 0, 0))  // 2026-06-12 UTC noon
  const end = new Date(Date.UTC(2026, 8, 3, 12, 0, 0))   // 2026-09-03 UTC noon
  while (cur <= end) {
    dates.push(cur.toISOString().split('T')[0])
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return dates
}

const ALL_DATES = buildTermDates()

const DATE_STRIP_DATA = ALL_DATES.map(date => {
  // Use UTC noon so getUTCDay() is always the correct weekday for this date string
  const jsDate = new Date(date + 'T12:00:00Z')
  const isSunday = jsDate.getUTCDay() === 0
  const isHoliday = date === INDEPENDENCE_DAY || date === MUHARRAM
  const isExamPeriod = date >= EXAM_START

  return {
    date,
    day_of_week: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][jsDate.getUTCDay()],
    is_sunday: isSunday,
    is_holiday: isHoliday,
    is_exam_period: isExamPeriod,
    holiday_name: date === INDEPENDENCE_DAY ? 'Independence Day' : date === MUHARRAM ? 'Muharram' : undefined,
    class_count: 0,
  }
})

const TIME_ORDER = [
  '10:20-11:35','11:55-13:10',
  '14:30-15:45','16:05-17:20','17:40-18:55',
  '19:15-20:30','20:50-22:05','22:25-23:40'
]

export default function MeetingsPage() {
  // Timezone-safe: build today's date from UTC parts to avoid IST-vs-UTC day shift
  const now = new Date()
  const todayDate = `${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,'0')}-${String(now.getUTCDate()).padStart(2,'0')}`
  const [date, setDate] = useState(() => {
    if (todayDate >= TERM_START && todayDate <= TERM_END) return todayDate
    return TERM_START
  })
  const [spcs, setSpcs] = useState<any[]>([])
  const [selectedRollNos, setSelectedRollNos] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetchAvailability()
  }, [date])

  const fetchAvailability = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/spcs/availability?date=${date}`)
      const data = await res.json()
      if (data.spcs) {
        setSpcs(data.spcs)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const toggleSpc = (roll_no: string) => {
    const newSet = new Set(selectedRollNos)
    if (newSet.has(roll_no)) newSet.delete(roll_no)
    else newSet.add(roll_no)
    setSelectedRollNos(newSet)
  }

  const selectAll = () => setSelectedRollNos(new Set(spcs.map(s => s.roll_no)))
  const clearAll = () => setSelectedRollNos(new Set())

  const selectedSpcs = spcs.filter(s => selectedRollNos.has(s.roll_no))
  let commonSlots: string[] = []
  if (selectedSpcs.length > 0) {
    commonSlots = TIME_ORDER.filter(slot => {
      return selectedSpcs.every(spc => spc.freeSlots.includes(slot))
    })
  }

  return (
    <div className="page-content" style={{ paddingBottom: '140px' }}>
      <Link href="/dashboard" className="btn btn-ghost" style={{ marginBottom: '24px', padding: '8px 16px', borderRadius: 'var(--radius-md)', display: 'inline-block' }}>
        ← Back to Dashboard
      </Link>
      
      <div className="page-header">
        <h1 className="page-title">Group Meeting Planner</h1>
        <p className="page-subtitle">Select members to find common free time slots between 10:00 AM and 11:59 PM.</p>
      </div>

      <div style={{ background: 'var(--bg-glass)', borderRadius: 'var(--radius-xl)', padding: '24px', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ marginBottom: '24px', margin: '0 -24px 24px -24px' }}>
          <label style={{ display: 'block', padding: '0 24px', fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Select Date</label>
          <DateStrip
            dates={DATE_STRIP_DATA}
            selectedDate={date}
            onSelectDate={setDate}
            todayDate={todayDate}
          />
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>Loading availability...</div>
        ) : (
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Select Members ({selectedRollNos.size}/{spcs.length})</h2>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button onClick={selectAll} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontWeight: 600, cursor: 'pointer', fontSize: '14px' }}>Select All</button>
                <button onClick={clearAll} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', fontSize: '14px' }}>Clear</button>
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px', marginBottom: '32px' }}>
              {spcs.map(spc => {
                const isSelected = selectedRollNos.has(spc.roll_no)
                return (
                  <div 
                    key={spc.roll_no}
                    onClick={() => toggleSpc(spc.roll_no)}
                    style={{ 
                      padding: '12px', 
                      borderRadius: 'var(--radius-md)', 
                      border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)'}`, 
                      background: isSelected ? 'var(--accent-primary-glow)' : 'var(--bg-surface)',
                      cursor: 'pointer',
                      transition: 'var(--transition)'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '14px', color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)' }}>{spc.name.split(' ')[0]}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{spc.roll_no}</div>
                  </div>
                )
              })}
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px' }}>Common Free Time</h2>
              
              {selectedRollNos.size === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)' }}>
                  Select at least one member to see their free time.
                </div>
              ) : commonSlots.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--accent-danger)', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-lg)' }}>
                  <div style={{ fontWeight: 700, marginBottom: '4px' }}>No common free slots found!</div>
                  <div style={{ fontSize: '14px', opacity: 0.8 }}>Try selecting fewer members or picking a different date.</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
                  {commonSlots.map(slot => (
                    <div key={slot} style={{ background: 'var(--gradient-primary)', color: 'white', borderRadius: 'var(--radius-lg)', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '16px', boxShadow: 'var(--shadow-accent)' }}>
                      {formatTime12Hour(slot)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
