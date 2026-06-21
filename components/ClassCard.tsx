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
      style={{ 
        '--slot-color': color, 
        backgroundColor: `${color}0A`, 
        border: `1px solid ${color}33`,
        padding: '16px',
        borderRadius: 'var(--radius-lg)',
        marginBottom: '16px'
      } as React.CSSProperties}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {timeSlot}
          </span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', background: '#f4f4f5', padding: '2px 8px', borderRadius: '12px' }}>
            {lr}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>Session {sessionNumber}</span>
          {totalClassesOccurred > 0 && (
            <div 
              title={`Attendance: ${attendancePerc}% (${attendedClasses}/${totalClassesOccurred})`}
              style={{
                width: '20px', height: '20px', borderRadius: '50%',
                background: attendanceBg,
                position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'white' }} />
            </div>
          )}
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: color, marginBottom: '2px', letterSpacing: '0.02em' }}>{courseAbbr}</div>
        <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2, letterSpacing: '-0.02em' }}>{cleanName}</h3>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>
            {initials || facultyAbbr.slice(0, 2)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>{faculty}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Section {section}</span>
          </div>
        </div>

        {entryId && onToggleAttendance && isPast && (
          <button
            onClick={() => onToggleAttendance(entryId, isPresent)}
            style={{
              background: isPresent ? '#10b981' : '#f4f4f5',
              color: isPresent ? 'white' : 'var(--text-secondary)',
              border: 'none',
              padding: '8px 16px', borderRadius: '24px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
              boxShadow: isPresent ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none'
            }}
          >
            {isPresent ? 'Present' : 'Mark'}
          </button>
        )}
      </div>
    </div>
  )
}
