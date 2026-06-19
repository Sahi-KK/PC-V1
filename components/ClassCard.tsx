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

  return (
    <div
      className="class-card animate-fade-up"
      style={{ '--slot-color': color } as React.CSSProperties}
    >
      <div className="class-card-header">
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="class-time-badge">
            ⏰ {timeSlot}
          </span>
          <span className="class-lr-badge">
            📍 {lr}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {totalClassesOccurred > 0 && (
            <div 
              title={`Attendance: ${attendancePerc}% (${attendedClasses}/${totalClassesOccurred})`}
              style={{
                width: '24px', height: '24px', borderRadius: '50%',
                background: attendanceBg,
                position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'white' }} />
            </div>
          )}
          <span className="class-session-num">#{sessionNumber}</span>
        </div>
      </div>

      <span className="class-course-abbr">{courseAbbr}</span>
      <h3 className="class-course-name">{cleanName}</h3>

      <div className="class-footer">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div className="class-faculty">
              <div className="class-faculty-avatar">{initials || facultyAbbr.slice(0, 2)}</div>
              <span className="class-faculty-name">{faculty}</span>
            </div>
            <span className="class-section-badge">Sec {section}</span>
          </div>

          {entryId && onToggleAttendance && isPast && (
            <div style={{ marginTop: '8px' }}>
              <button
                onClick={() => onToggleAttendance(entryId, isPresent)}
                style={{
                  width: '100%',
                  background: isPresent ? 'var(--accent-primary-glow)' : 'transparent',
                  color: isPresent ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  border: `1px solid ${isPresent ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                  padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                }}
              >
                {isPresent ? '✅ Present' : 'Mark Present'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
