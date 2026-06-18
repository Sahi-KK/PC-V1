export interface Course {
  abbr: string
  full_name: string
  faculty: string
  faculty_abbr: string
  credit: number
}

export interface Student {
  id: string
  roll_no: string
  name: string
}

export interface StudentCourse {
  student_id: string
  course_abbr: string
  section: string
}

export interface CalendarEntry {
  id: string
  date: string
  day_of_week: string
  section: string
  lr: string
  time_slot: string
  class_code: string
  course_abbr: string
  session_number: number
  note: string | null
  is_holiday: boolean
  is_exam_period: boolean
}

export interface UserProfile {
  id: string
  roll_no: string
  name: string
  email: string
}

export interface ScheduleSlot {
  time_slot: string
  class_code: string
  course_abbr: string
  course_full_name: string
  faculty: string
  faculty_abbr: string
  session_number: number
  lr: string
  section: string
}

export interface DaySchedule {
  date: string
  day_of_week: string
  is_sunday: boolean
  is_holiday: boolean
  is_exam_period: boolean
  holiday_name?: string
  slots: ScheduleSlot[]
}
