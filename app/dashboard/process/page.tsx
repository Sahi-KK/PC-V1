'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import DateStrip from '@/components/DateStrip'

interface SPC {
  roll_no: string
  name: string
  freeSlots: string[]
}

interface Process {
  id: string
  name: string
  date: string
  time_slot: string
  created_at: string
  spcs: { roll_no: string, name: string }[]
}

const TIME_ORDER = [
  '08:45-10:00','10:20-11:35','11:55-1:10',
  '14:30-15:45','16:05-17:20','17:40-18:55',
  '19:15-20:30','20:50-22:05','22:25-23:40'
]

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

const DATE_STRIP_DATA = ALL_DATES.map(date => {
  const jsDate = new Date(date + 'T00:00:00')
  const isSunday = jsDate.getDay() === 0
  const isHoliday = date === INDEPENDENCE_DAY
  const isExamPeriod = date >= EXAM_START

  return {
    date,
    day_of_week: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][jsDate.getDay()],
    is_sunday: isSunday,
    is_holiday: isHoliday,
    is_exam_period: isExamPeriod,
    holiday_name: isHoliday ? 'Independence Day' : undefined,
    class_count: 0,
  }
})

export default function ProcessDatePage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [processes, setProcesses] = useState<Process[]>([])
  
  // Form State
  const todayDate = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState('')
  const [name, setName] = useState('')
  const [selectedSlot, setSelectedSlot] = useState('')
  const [selectedSPCs, setSelectedSPCs] = useState<Set<string>>(new Set())
  
  // Availability State
  const [loadingAvailability, setLoadingAvailability] = useState(false)
  const [spcAvailability, setSpcAvailability] = useState<SPC[]>([])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      
      // Auto-select today or start of term
      if (todayDate >= TERM_START && todayDate <= TERM_END) {
        setDate(todayDate)
      } else {
        setDate(TERM_START)
      }

      fetchProcesses()
    }
    init()
  }, [])

  async function fetchProcesses() {
    const res = await fetch('/api/processes')
    const data = await res.json()
    if (data.processes) setProcesses(data.processes)
    setLoading(false)
  }

  useEffect(() => {
    if (!date) return
    async function checkAvailability() {
      setLoadingAvailability(true)
      setSelectedSlot('')
      setSelectedSPCs(new Set())
      
      const res = await fetch(`/api/spcs/availability?date=${date}`)
      const data = await res.json()
      if (data.spcs) setSpcAvailability(data.spcs)
      setLoadingAvailability(false)
    }
    checkAvailability()
  }, [date])

  const toggleSPC = (roll_no: string) => {
    const next = new Set(selectedSPCs)
    if (next.has(roll_no)) next.delete(roll_no)
    else next.add(roll_no)
    setSelectedSPCs(next)
  }

  const handleSchedule = async () => {
    if (!name || !date || !selectedSlot || selectedSPCs.size === 0) return
    
    const payload = {
      name,
      date,
      time_slot: selectedSlot,
      spc_roll_nos: Array.from(selectedSPCs)
    }

    const res = await fetch('/api/processes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (res.ok) {
      setName('')
      setSelectedSlot('')
      setSelectedSPCs(new Set())
      fetchProcesses()
    } else {
      alert('Failed to schedule process.')
    }
  }

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading-full"><div className="spinner" />Loading processes...</div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <header className="mobile-header">
        <div className="mobile-header-logo">
          <span className="topbar-logo-name">Process Scheduler</span>
        </div>
      </header>

      <main className="page-content" style={{ paddingBottom: '100px' }}>
        <h1 className="page-title" style={{ marginBottom: '8px' }}>Schedule a Process</h1>
        <p className="page-subtitle" style={{ marginBottom: '24px' }}>
          Select a date to view real-time availability of SPC members based on their class schedules.
        </p>

        {/* Scheduling Form */}
        <div style={{
          background: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-card)', marginBottom: '32px'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, fontSize: '14px', color: 'var(--text-secondary)' }}>Process Name</label>
              <input 
                type="text" 
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. McKinsey First Round Interviews"
                style={{
                  width: '100%', padding: '12px', borderRadius: '8px',
                  border: '1px solid var(--border-subtle)', background: 'var(--bg-body)',
                  color: 'var(--text-primary)', outline: 'none'
                }}
              />
            </div>
            
            <div style={{ margin: '0 -20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', padding: '0 20px', fontWeight: 500, fontSize: '14px', color: 'var(--text-secondary)' }}>Target Date</label>
              <DateStrip
                dates={DATE_STRIP_DATA}
                selectedDate={date}
                onSelectDate={setDate}
                todayDate={todayDate}
              />
            </div>

            {loadingAvailability && (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '14px' }}>
                Calculating SPC availability from calendar...
              </div>
            )}

            {date && !loadingAvailability && spcAvailability.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, fontSize: '14px', color: 'var(--text-secondary)' }}>
                  1. Select Time Slot
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
                  {TIME_ORDER.map(slot => (
                    <button
                      key={slot}
                      onClick={() => { setSelectedSlot(slot); setSelectedSPCs(new Set()) }}
                      style={{
                        padding: '8px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 500,
                        border: selectedSlot === slot ? 'none' : '1px solid var(--border-subtle)',
                        background: selectedSlot === slot ? 'var(--accent-primary)' : 'var(--bg-body)',
                        color: selectedSlot === slot ? 'white' : 'var(--text-primary)',
                        cursor: 'pointer'
                      }}
                    >
                      {slot}
                    </button>
                  ))}
                </div>

                {selectedSlot && (
                  <>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, fontSize: '14px', color: 'var(--text-secondary)' }}>
                      2. Assign Available SPCs
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                      {spcAvailability.map(spc => {
                        const isFree = spc.freeSlots.includes(selectedSlot)
                        const isSelected = selectedSPCs.has(spc.roll_no)

                        return (
                          <div
                            key={spc.roll_no}
                            onClick={() => isFree && toggleSPC(spc.roll_no)}
                            style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: '12px', borderRadius: '8px',
                              background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-body)',
                              border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                              cursor: isFree ? 'pointer' : 'not-allowed',
                              opacity: isFree ? 1 : 0.5
                            }}
                          >
                            <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{spc.name}</div>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: isFree ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                              {isFree ? 'Free' : 'In Class'}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <button
                      onClick={handleSchedule}
                      disabled={selectedSPCs.size === 0 || !name}
                      style={{
                        width: '100%', padding: '14px', borderRadius: '8px', marginTop: '24px',
                        background: selectedSPCs.size > 0 && name ? 'var(--accent-primary)' : 'var(--bg-body)',
                        color: selectedSPCs.size > 0 && name ? 'white' : 'var(--text-muted)',
                        border: 'none', fontWeight: 600, cursor: selectedSPCs.size > 0 && name ? 'pointer' : 'not-allowed'
                      }}
                    >
                      Schedule Process
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Process List */}
        <h2 className="page-title" style={{ fontSize: '20px', marginBottom: '16px' }}>Upcoming Processes</h2>
        {processes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)' }}>
            No processes scheduled yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {processes.map(p => {
              const d = new Date(p.date)
              return (
                <div key={p.id} style={{
                  background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-card)', border: '1px solid var(--border-subtle)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--accent-primary)', background: 'rgba(59, 130, 246, 0.1)', padding: '4px 8px', borderRadius: '4px' }}>
                      {d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} • {p.time_slot}
                    </div>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <span style={{ fontWeight: 600 }}>Assigned SPCs:</span> {p.spcs.map(s => s.name).join(', ')}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
