'use client'

interface ClassCardProps {
  timeSlot: string
  classCode: string
  courseAbbr: string
  courseFullName: string
  faculty: string
  facultyAbbr: string
  sessionNumber: number
  lr: string
  section: string
  colorIndex: number
  attendedClasses?: number
  totalClassesOccurred?: number
  entryId?: string
  isPresent?: boolean
  isPast?: boolean
  onToggleAttendance?: (entryId: string, isCurrentlyPresent: boolean) => void
}

const SLOT_COLORS = [
  '#6c63ff', '#00d4aa', '#f59e0b', '#e879f9',
  '#3b82f6', '#10b981', '#f97316', '#ec4899', '#06b6d4'
]

export default function ClassCard({
  timeSlot, classCode, courseAbbr, courseFullName,
  faculty, facultyAbbr, sessionNumber, lr, section, colorIndex,
  attendedClasses = 0, totalClassesOccurred = 0,
  entryId, isPresent = false, isPast = false, onToggleAttendance
}: ClassCardProps) {
  const color = SLOT_COLORS[colorIndex % SLOT_COLORS.length]
  const initials = faculty
    .split(' ')
    .filter(w => w.length > 0 && w !== 'Dr.' && w !== 'Prof.' && w !== 'Dr')
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')

  // Extract display course name (remove parenthetical abbr at the end)
  const cleanName = courseFullName.replace(/\s*\([^)]+\)\s*$/, '')

  // Calculate attendance
  const attendancePerc = totalClassesOccurred > 0 ? Math.round((attendedClasses / totalClassesOccurred) * 100) : 100
  const isLowAttendance = attendancePerc < 80
  const attendanceColor = isLowAttendance ? 'var(--accent-danger)' : 'var(--accent-primary)'
  const attendanceBg = `conic-gradient(${attendanceColor} ${attendancePerc}%, #e2e8f0 ${attendancePerc}%)`

  const startTime = timeSlot.split('-')[0]
  
  return (
    <div className="class-card animate-fade-up" style={{ display: 'flex', gap: '16px', position: 'relative', opacity: isPast ? 0.6 : 1, transition: 'opacity 0.2s' }}>
      
      {/* Timeline Column */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '48px', flexShrink: 0 }}>
        <div style={{ fontSize: '12px', fontWeight: 800, color: isPast ? 'var(--text-muted)' : 'var(--text-primary)', marginTop: '2px' }}>
          {startTime}
        </div>
        <div style={{ 
          width: '10px', height: '10px', borderRadius: '50%', 
          background: isPast ? 'var(--border-subtle)' : color, 
          margin: '8px 0',
          boxShadow: isPast ? 'none' : `0 0 0 4px ${color}33`
        }} />
        <div style={{ flex: 1, width: '2px', background: 'var(--border-subtle)', opacity: 0.5, minHeight: '40px' }} />
      </div>

      {/* Content Column */}
      <div style={{ flex: 1, paddingBottom: '24px' }}>
        <div style={{ 
          background: 'var(--bg-surface)', 
          border: '1px solid var(--border-subtle)', 
          borderRadius: 'var(--radius-lg)',
          padding: '16px',
          boxShadow: 'var(--shadow-sm)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: color }} />
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
            <div style={{ fontSize: '12px', fontWeight: 800, color: color, letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {courseAbbr}
              <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-base)', padding: '2px 6px', borderRadius: '10px' }}>
                Session {sessionNumber}
              </span>
            </div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', background: 'var(--bg-base)', padding: '4px 8px', borderRadius: '6px' }}>
              📍 {lr}
            </div>
          </div>

          <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.3, letterSpacing: '-0.01em', marginBottom: '12px' }}>
            {cleanName}
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                {initials || facultyAbbr.slice(0, 2)}
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>{faculty}</span>
            </div>

            {entryId && onToggleAttendance && (
              <button
                onClick={() => onToggleAttendance(entryId, isPresent)}
                style={{
                  background: isPresent ? '#10b981' : 'var(--bg-base)',
                  color: isPresent ? 'white' : 'var(--text-secondary)',
                  border: isPresent ? 'none' : '1px solid var(--border-subtle)',
                  padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isPresent ? '0 4px 12px rgba(16, 185, 129, 0.2)' : 'none'
                }}
              >
                {isPresent ? '✓ Marked' : 'Mark'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
