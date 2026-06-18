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
}

const SLOT_COLORS = [
  '#6c63ff', '#00d4aa', '#f59e0b', '#e879f9',
  '#3b82f6', '#10b981', '#f97316', '#ec4899', '#06b6d4'
]

export default function ClassCard({
  timeSlot, classCode, courseAbbr, courseFullName,
  faculty, facultyAbbr, sessionNumber, lr, section, colorIndex
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
        <span className="class-session-num">#{sessionNumber}</span>
      </div>

      <span className="class-course-abbr">{courseAbbr}</span>
      <h3 className="class-course-name">{cleanName}</h3>

      <div className="class-footer">
        <div className="class-faculty">
          <div className="class-faculty-avatar">{initials || facultyAbbr.slice(0, 2)}</div>
          <span className="class-faculty-name">{faculty}</span>
        </div>
        <span className="class-section-badge">Sec {section}</span>
      </div>
    </div>
  )
}
