'use client'

import { useRef, useEffect } from 'react'

interface DatePillData {
  date: string          // YYYY-MM-DD
  day_of_week: string
  is_sunday: boolean
  is_holiday: boolean
  is_exam_period: boolean
  holiday_name?: string
  class_count: number
}

interface DateStripProps {
  dates: DatePillData[]
  selectedDate: string
  onSelectDate: (date: string) => void
  todayDate: string
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS = ['SUN','MON','TUE','WED','THU','FRI','SAT']

export default function DateStrip({ dates, selectedDate, onSelectDate, todayDate }: DateStripProps) {
  const stripRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<HTMLButtonElement>(null)

  // Scroll selected pill into view
  useEffect(() => {
    if (selectedRef.current && stripRef.current) {
      selectedRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [selectedDate])

  // Scroll today into view on mount
  useEffect(() => {
    setTimeout(() => {
      const todayEl = stripRef.current?.querySelector(`[data-date="${todayDate}"]`)
      if (todayEl) {
        (todayEl as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
      }
    }, 100)
  }, [todayDate])

  return (
    <div className="date-strip-wrapper">
      <div className="legend">
        <div className="legend-item">
          <div className="legend-dot" style={{ background: 'var(--accent-primary)', opacity: 0.7 }} />
          <span>Class day</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: 'var(--accent-sunday)', opacity: 0.7 }} />
          <span>Sunday</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: 'var(--accent-holiday)', opacity: 0.7 }} />
          <span>Holiday</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: 'var(--accent-exam)', opacity: 0.7 }} />
          <span>End-term exams</span>
        </div>
      </div>

      <div className="date-strip" ref={stripRef}>
        {dates.map((d) => {
          const [year, month, day] = d.date.split('-').map(Number)
          const jsDate = new Date(year, month - 1, day)
          const dayOfWeek = DAYS[jsDate.getDay()]
          const isActive = d.date === selectedDate
          const isToday = d.date === todayDate

          let pillClass = 'date-pill'
          if (isActive) pillClass += ' active'
          if (isToday && !isActive) pillClass += ' today'
          if (d.is_sunday && !isActive) pillClass += ' sunday'
          if (d.is_holiday && !isActive) pillClass += ' holiday'
          if (d.is_exam_period && !isActive) pillClass += ' exam-period'
          if (d.class_count > 0 && !d.is_sunday && !d.is_holiday && !d.is_exam_period) {
            pillClass += ' has-classes'
          }

          return (
            <button
              key={d.date}
              className={pillClass}
              data-date={d.date}
              onClick={() => onSelectDate(d.date)}
              ref={isActive ? selectedRef : undefined}
              title={d.is_holiday ? d.holiday_name : d.is_exam_period ? 'End-term Exam Period' : undefined}
            >
              {d.is_holiday && <span className="date-badge date-badge-holiday">HOL</span>}
              {d.is_exam_period && !d.is_holiday && <span className="date-badge date-badge-exam">EXAM</span>}

              <span className="date-day">{dayOfWeek}</span>
              <span className="date-num">{day}</span>
              <span className="date-month">{MONTHS[month - 1]}</span>
              <div className="date-dot-row">
                {d.class_count > 0 && !d.is_sunday && !d.is_holiday && !d.is_exam_period
                  ? Array.from({ length: Math.min(d.class_count, 4) }).map((_, i) => (
                      <div key={i} className="date-class-dot" />
                    ))
                  : null}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
