'use client'

import { useEffect, useState } from 'react'
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
  created_by: string
  creator_name: string
  spcs: { roll_no: string, name: string }[]
}

interface GroupedProcess {
  key: string
  name: string
  date: string
  creator_name: string
  created_by: string
  slots: {
    id: string
    time_slot: string
    spcs: { roll_no: string, name: string }[]
  }[]
}

const TIME_ORDER = [
  '08:45-10:00','10:20-11:35','11:55-13:10',
  '14:30-15:45','16:05-17:20','17:40-18:55',
  '19:15-20:30','20:50-22:05','22:25-23:40'
]

const TERM_START = '2026-06-12'
const TERM_END   = '2026-09-03'
const EXAM_START = '2026-08-23'
const INDEPENDENCE_DAY = '2026-08-15'
const MUHARRAM = '2026-06-26'

function formatTime12Hour(timeStr: string) {
  if (timeStr === 'LUNCH') return 'Lunch'
  const [start, end] = timeStr.split('-')
  if (!start || !end) return timeStr
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
  // Use UTC noon to avoid IST-vs-UTC day-shift
  const cur = new Date(Date.UTC(2026, 5, 12, 12, 0, 0))
  const end = new Date(Date.UTC(2026, 8, 3, 12, 0, 0))
  while (cur <= end) {
    dates.push(cur.toISOString().split('T')[0])
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return dates
}

const ALL_DATES = buildTermDates()

const DATE_STRIP_DATA = ALL_DATES.map(date => {
  // Use UTC noon so getUTCDay() returns correct weekday regardless of local timezone
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

export default function ProcessTab() {
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [processes, setProcesses] = useState<GroupedProcess[]>([])
  const [currentUserId, setCurrentUserId] = useState<string>('')
  
  // Form State
  // Timezone-safe today's date (IST)
  const now = new Date()
  const todayDate = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const [date, setDate] = useState('')
  const [name, setName] = useState('')
  const [selectedSlot, setSelectedSlot] = useState('')
  
  // slot -> Set of roll numbers
  const [slotSelections, setSlotSelections] = useState<Record<string, Set<string>>>({})
  
  // Availability State
  const [loadingAvailability, setLoadingAvailability] = useState(false)
  const [spcAvailability, setSpcAvailability] = useState<SPC[]>([])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
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
    if (data.processes) {
      setCurrentUserId(data.current_user_id)
      
      // Group by name + date
      const grouped = new Map<string, GroupedProcess>()
      data.processes.forEach((p: Process) => {
        const key = `${p.name}_${p.date}`
        if (!grouped.has(key)) {
          grouped.set(key, {
            key,
            name: p.name,
            date: p.date,
            creator_name: p.creator_name,
            created_by: p.created_by,
            slots: []
          })
        }
        grouped.get(key)!.slots.push({
          id: p.id,
          time_slot: p.time_slot,
          spcs: p.spcs
        })
      })
      setProcesses(Array.from(grouped.values()))
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!date) return
    async function checkAvailability() {
      setLoadingAvailability(true)
      setSelectedSlot('')
      setSlotSelections({})
      
      const res = await fetch(`/api/spcs/availability?date=${date}`)
      const data = await res.json()
      if (data.spcs) setSpcAvailability(data.spcs)
      setLoadingAvailability(false)
    }
    checkAvailability()
  }, [date])

  const toggleSPC = (roll_no: string) => {
    if (!selectedSlot) return
    setSlotSelections(prev => {
      const nextMap = { ...prev }
      const slotSet = new Set(nextMap[selectedSlot] || [])
      if (slotSet.has(roll_no)) {
        slotSet.delete(roll_no)
      } else {
        slotSet.add(roll_no)
      }
      nextMap[selectedSlot] = slotSet
      return nextMap
    })
  }

  const handleDelete = async (gp: GroupedProcess) => {
    if (!confirm(`Are you sure you want to delete ${gp.name}?`)) return
    
    // Delete all slots concurrently
    await Promise.all(gp.slots.map(s => fetch(`/api/processes?id=${s.id}`, { method: 'DELETE' })))
    
    fetchProcesses()
  }

  const handleSchedule = async () => {
    // Transform slotSelections into payload format
    const slots = []
    for (const [time_slot, spcSet] of Object.entries(slotSelections)) {
      if (spcSet.size > 0) {
        slots.push({
          time_slot,
          spc_roll_nos: Array.from(spcSet)
        })
      }
    }
    
    if (!name || !date || slots.length === 0) return
    
    const payload = {
      name,
      date,
      slots
    }

    const res = await fetch('/api/processes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (res.ok) {
      setName('')
      setSelectedSlot('')
      setSlotSelections({})
      fetchProcesses()
    } else {
      alert('Failed to schedule process.')
    }
  }

  const totalSelectedCount = Object.values(slotSelections).reduce((acc, set) => acc + set.size, 0)

  if (loading) {
    return (
      <div className="loading-full"><div className="spinner" />Loading processes...</div>
    )
  }

  return (
    <>
      <div style={{ marginBottom: '24px' }}>
        <h1 className="page-title" style={{ marginBottom: '8px' }}>Schedule a Process</h1>
        <p className="page-subtitle">
          Select a date, then choose multiple time slots and assign available SPCs to each slot.
        </p>
      </div>

      {/* Scheduling Form */}
      <div style={{
        background: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-card)', marginBottom: '32px', border: '1px solid var(--border-subtle)'
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
                1. Select a Time Slot to configure
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
                {TIME_ORDER.map(slot => {
                  const hasSelections = slotSelections[slot] && slotSelections[slot].size > 0
                  const isActive = selectedSlot === slot
                  
                  let bg = 'var(--bg-body)'
                  let color = 'var(--text-primary)'
                  let border = '1px solid var(--border-subtle)'
                  
                  if (isActive) {
                    bg = 'var(--accent-primary)'
                    color = 'white'
                    border = '1px solid var(--accent-primary)'
                  } else if (hasSelections) {
                    bg = 'rgba(16, 185, 129, 0.1)'
                    color = 'var(--accent-primary)'
                    border = '1px solid var(--accent-primary)'
                  }
                  
                  return (
                    <button
                      key={slot}
                      onClick={() => setSelectedSlot(slot)}
                      style={{
                        padding: '8px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 500,
                        border, background: bg, color, cursor: 'pointer', transition: 'var(--transition)'
                      }}
                    >
                      {formatTime12Hour(slot)} {hasSelections ? `(${slotSelections[slot].size})` : ''}
                    </button>
                  )
                })}
              </div>

              {selectedSlot ? (
                <>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, fontSize: '14px', color: 'var(--text-secondary)' }}>
                    2. Assign Available SPCs for <span style={{ color: 'var(--accent-primary)' }}>{formatTime12Hour(selectedSlot)}</span>
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                    {spcAvailability.map(spc => {
                      const isFree = spc.freeSlots.includes(selectedSlot)
                      const isSelected = slotSelections[selectedSlot]?.has(spc.roll_no)

                      return (
                        <div
                          key={spc.roll_no}
                          onClick={() => isFree && toggleSPC(spc.roll_no)}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '12px', borderRadius: '8px',
                            background: isSelected ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-body)',
                            border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                            cursor: isFree ? 'pointer' : 'not-allowed',
                            opacity: isFree ? 1 : 0.5
                          }}
                        >
                          <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{spc.name}</div>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: isFree ? '#10b981' : '#ef4444' }}>
                            {isFree ? 'Free' : 'In Class'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', border: '1px dashed var(--border-subtle)', borderRadius: '8px' }}>
                  Click a time slot above to assign people to it.
                </div>
              )}

              <button
                onClick={handleSchedule}
                disabled={totalSelectedCount === 0 || !name}
                style={{
                  width: '100%', padding: '14px', borderRadius: '8px', marginTop: '24px',
                  background: totalSelectedCount > 0 && name ? 'var(--accent-primary)' : 'var(--bg-body)',
                  color: totalSelectedCount > 0 && name ? 'white' : 'var(--text-muted)',
                  border: 'none', fontWeight: 600, cursor: totalSelectedCount > 0 && name ? 'pointer' : 'not-allowed',
                  transition: 'var(--transition)'
                }}
              >
                Schedule Process
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Process List */}
      <h2 className="page-title" style={{ fontSize: '20px', marginBottom: '16px' }}>Upcoming Processes</h2>
      {processes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          No processes scheduled yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {processes.map(p => {
            const [y, m, d] = p.date.split('-').map(Number)
            // Format date directly from string parts — avoids local timezone shifting the day
            const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
            const displayDate = `${d} ${months[m-1]} ${y}`
            const isOwner = p.created_by === currentUserId
            
            return (
              <div key={p.key} style={{
                background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-card)', border: '1px solid var(--border-subtle)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>{p.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Created by: <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{p.creator_name}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-primary)', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 8px', borderRadius: '6px' }}>
                      {displayDate}
                    </div>
                    {isOwner && (
                      <button 
                        onClick={() => handleDelete(p)}
                        style={{ 
                          background: 'transparent', border: 'none', color: '#ef4444', 
                          fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: '4px 8px',
                          display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px'
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                        Delete
                      </button>
                    )}
                  </div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                  {p.slots.map(slot => (
                    <div key={slot.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <div style={{ 
                        fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', 
                        background: '#f4f4f5', padding: '4px 8px', borderRadius: '6px',
                        border: '1px solid var(--border-subtle)', whiteSpace: 'nowrap'
                      }}>
                        {formatTime12Hour(slot.time_slot)}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500, alignSelf: 'center', lineHeight: 1.4 }}>
                        {slot.spcs.length > 0 ? slot.spcs.map(s => s.name).join(', ') : <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>No SPCs assigned</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
