'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

interface ScheduleEntry {
  id: string
  date: string
  time_slot: string
  session_number: number
  course_abbr: string
  is_holiday: boolean
  is_exam_period: boolean
}

export default function CourseAttendancePage() {
  const router = useRouter()
  const params = useParams()
  const courseAbbr = typeof params?.course === 'string' ? decodeURIComponent(params.course) : ''
  
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<ScheduleEntry[]>([])
  const [attendedIds, setAttendedIds] = useState<Set<string>>(new Set())
  
  const supabase = createClient()
  // Timezone-safe today's date (IST)
  const todayDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

  useEffect(() => {
    async function load() {
      function processData(allEntries: any[], attendance: any[]) {
        const courseEntries = allEntries
          .filter(e => e.course_abbr === courseAbbr && !e.is_holiday && !e.is_exam_period)
          .sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date)
            return a.time_slot.localeCompare(b.time_slot)
          })
        
        setEntries(courseEntries)
        setAttendedIds(new Set(attendance.filter((a: any) => a.is_present).map((a: any) => a.calendar_entry_id)))
      }

      try {
        const cached = localStorage.getItem('pc_v1_schedule_cache')
        if (cached) {
          const parsed = JSON.parse(cached)
          if (parsed.entries && parsed.attendance) {
            processData(parsed.entries, parsed.attendance)
            setLoading(false)
          }
        }
      } catch(e) {}

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [profRes, attRes] = await Promise.all([
        supabase.from('user_profiles').select('roll_no').eq('id', user.id).single(),
        fetch('/api/attendance').then(r => r.json())
      ])

      const prof = profRes.data
      if (!prof) return

      const res = await fetch(`/api/schedule?roll_no=${prof.roll_no}`)
      const data = await res.json()
      
      const allEntries: ScheduleEntry[] = data.entries || []
      const attendance = attRes.attendance || []

      processData(allEntries, attendance)
      
      try {
        localStorage.setItem('pc_v1_schedule_cache', JSON.stringify({
          profile: prof,
          entries: allEntries,
          enrollments: data.enrollments || [],
          attendance: attendance
        }))
      } catch (e) {}

      setLoading(false)
    }
    load()
  }, [courseAbbr, router, supabase])

  const toggleAttendance = async (entryId: string, isCurrentlyPresent: boolean) => {
    // Optimistic UI update
    const newAttended = new Set(attendedIds)
    if (isCurrentlyPresent) newAttended.delete(entryId)
    else newAttended.add(entryId)
    setAttendedIds(newAttended)

    // Update global cache so other tabs see it instantly
    try {
      const cached = localStorage.getItem('pc_v1_schedule_cache')
      if (cached) {
        const parsed = JSON.parse(cached)
        const currentAtt = parsed.attendance || []
        const newAttArray = isCurrentlyPresent
          ? currentAtt.filter((a: any) => a.calendar_entry_id !== entryId)
          : [...currentAtt, { calendar_entry_id: entryId, is_present: true }]
        parsed.attendance = newAttArray
        localStorage.setItem('pc_v1_schedule_cache', JSON.stringify(parsed))
      }
    } catch (e) {}

    const action = isCurrentlyPresent ? 'undo' : 'present'
    await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ calendar_entry_id: entryId, action })
    })
  }

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading-full"><div className="spinner" />Loading course details...</div>
      </div>
    )
  }

  const occurredEntries = entries.filter(e => e.date <= todayDate)
  const total = occurredEntries.length
  const attended = occurredEntries.filter(e => attendedIds.has(e.id)).length
  const percentage = total > 0 ? Math.round((attended / total) * 100) : 100

  return (
    <div className="dashboard">
      <header className="mobile-header">
        <div className="mobile-header-logo" style={{ cursor: 'pointer' }} onClick={() => router.back()}>
          <span className="topbar-logo-name">← Back</span>
        </div>
      </header>

      <main className="page-content" style={{ paddingBottom: '100px' }}>
        <h1 className="page-title">{courseAbbr} Attendance</h1>
        
        <div style={{
          background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-card)', marginBottom: '24px', display: 'flex', justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Classes Attended</div>
            <div style={{ fontSize: '24px', fontWeight: 700 }}>{attended} / {total}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Percentage</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: percentage < 80 ? 'var(--accent-danger)' : 'var(--accent-primary)' }}>
              {percentage}%
            </div>
          </div>
        </div>

        <h3 style={{ fontSize: '16px', marginBottom: '12px', color: 'var(--text-primary)' }}>Class History</h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {entries.map(entry => {
            const isPast = entry.date <= todayDate
            const isPresent = attendedIds.has(entry.id)
            
            return (
              <div key={entry.id} style={{
                background: 'var(--bg-card)', padding: '12px 16px', borderRadius: 'var(--radius-sm)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                opacity: isPast ? 1 : 0.6, border: '1px solid var(--border-subtle)'
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>Session {entry.session_number}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{entry.date} • {entry.time_slot}</div>
                </div>
                
                {isPast ? (
                  <button
                    onClick={() => toggleAttendance(entry.id, isPresent)}
                    style={{
                      background: isPresent ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: isPresent ? '#10b981' : '#ef4444',
                      border: `1px solid ${isPresent ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                      padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {isPresent ? '✓ Attended' : '✗ Missed'}
                  </button>
                ) : (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Upcoming</span>
                )}
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
