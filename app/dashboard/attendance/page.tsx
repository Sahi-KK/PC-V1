'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

interface ScheduleEntry {
  id: string
  date: string
  course_abbr: string
  course_full_name: string
  is_holiday: boolean
  is_exam_period: boolean
}

export default function AttendancePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [courses, setCourses] = useState<{abbr: string, fullName: string, attended: number, total: number, percentage: number}[]>([])
  
  const supabase = createClient()
  // Timezone-safe today's date (IST)
  const todayDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

  useEffect(() => {
    async function load() {
      function processData(entries: any[], enrollments: any[], attendance: any[]) {
        const attendedIds = new Set(attendance.filter((a: any) => a.is_present).map((a: any) => a.calendar_entry_id))
        const courseStats = enrollments.map(enr => {
          const courseEntries = entries.filter(e => e.course_abbr === enr.course_abbr)
          const fullName = courseEntries.length > 0 ? courseEntries[0].course_full_name : enr.course_abbr
          
          const occurredEntries = courseEntries.filter(e => e.date <= todayDate && !e.is_holiday && !e.is_exam_period)
          const total = occurredEntries.length
          const attended = occurredEntries.filter(e => attendedIds.has(e.id)).length
          const percentage = total > 0 ? Math.round((attended / total) * 100) : 100

          return {
            abbr: enr.course_abbr,
            fullName: fullName.replace(/\s*\([^)]+\)\s*$/, ''),
            attended,
            total,
            percentage
          }
        })
        setCourses(courseStats)
      }

      try {
        const cached = localStorage.getItem('pc_v1_schedule_cache')
        if (cached) {
          const parsed = JSON.parse(cached)
          if (parsed.entries && parsed.enrollments && parsed.attendance) {
            processData(parsed.entries, parsed.enrollments, parsed.attendance)
            setLoading(false)
          }
        }
      } catch(e) {}

      try {
        const res = await fetch(`/api/schedule`)
        if (res.status === 401) { router.push('/login'); return }
        const data = await res.json()
        
        const entries: ScheduleEntry[] = data.entries || []
        const enrollments: {course_abbr: string}[] = data.enrollments || []
        const attendance = data.attendance || []
        const prof = data.profile || null

        processData(entries, enrollments, attendance)
        
        try {
          localStorage.setItem('pc_v1_schedule_cache', JSON.stringify({
            profile: prof,
            entries: entries,
            enrollments: enrollments,
            attendance: attendance
          }))
        } catch (e) {}
      } catch (e) {}

      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading-full">
          <div className="spinner" />
          Loading attendance...
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <header className="mobile-header">
        <div className="mobile-header-logo">
          <span className="topbar-logo-name">Attendance Tracker</span>
        </div>
      </header>

      <main className="page-content" style={{ paddingBottom: '100px' }}>
        <h1 className="page-title" style={{ marginBottom: '8px' }}>Your Attendance</h1>
        <p className="page-subtitle" style={{ marginBottom: '24px' }}>
          Minimum 80% attendance is strictly required per course.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {courses.map(course => (
            <div 
              key={course.abbr}
              onClick={() => router.push(`/dashboard/attendance/${course.abbr}`)}
              style={{
                background: 'var(--bg-card)',
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-card)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'var(--transition)',
                border: '1px solid transparent',
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
            >
              <div>
                <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>{course.abbr}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{course.fullName}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {course.attended} / {course.total} classes attended
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <div style={{
                  fontSize: '24px',
                  fontWeight: 700,
                  color: course.percentage < 80 ? 'var(--accent-danger)' : 'var(--accent-primary)'
                }}>
                  {course.percentage}%
                </div>
                {course.percentage < 80 && course.total > 0 && (
                  <span style={{
                    fontSize: '11px', fontWeight: 600, color: 'white',
                    background: 'var(--accent-danger)', padding: '2px 6px',
                    borderRadius: '4px', marginTop: '4px'
                  }}>
                    Low Attendance
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
