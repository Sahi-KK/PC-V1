'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

interface Course {
  abbr: string
  full_name: string
  faculty: string
}

interface ProfileModalProps {
  profile: { name: string; roll_no: string; email: string }
  onClose: () => void
}

export default function ProfileModal({ profile, onClose }: ProfileModalProps) {
  const router = useRouter()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  
  const supabase = createClient()

  useEffect(() => {
    async function fetchCourses() {
      // Get student id
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('roll_no', profile.roll_no)
        .single()
        
      if (student) {
        // Get enrolled course abbrs
        const { data: enrollments } = await supabase
          .from('student_courses')
          .select('course_abbr')
          .eq('student_id', student.id)
          
        const abbrs = enrollments?.map(e => e.course_abbr).filter(a => a !== 'CW-') || []
        
        if (abbrs.length > 0) {
          const { data: coursesData } = await supabase
            .from('courses')
            .select('abbr, full_name, faculty')
            .in('abbr', abbrs)
            
          if (coursesData) {
            setCourses(coursesData)
          }
        }
      }
      setLoading(false)
    }
    
    fetchCourses()

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [profile.roll_no])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleDeleteAccount() {
    if (!confirm('Are you absolutely sure you want to permanently delete your account? This action cannot be undone.')) {
      return
    }
    setDeleting(true)
    try {
      const res = await fetch('/api/auth/delete', { method: 'DELETE' })
      if (res.ok) {
        await supabase.auth.signOut()
        router.push('/login')
      } else {
        alert('Failed to delete account. Please try again.')
        setDeleting(false)
      }
    } catch (e) {
      alert('Error connecting to server.')
      setDeleting(false)
    }
  }

  return (
    <div className="profile-modal-overlay">
      <div className="profile-modal-content" ref={modalRef}>
        <button className="profile-modal-close" onClick={onClose}>&times;</button>
        
        <div className="profile-modal-header">
          <div className="profile-modal-avatar">
            {profile.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
          </div>
          <div className="profile-modal-info">
            <h2>{profile.name}</h2>
            <p className="profile-modal-roll">{profile.roll_no}</p>
            <p className="profile-modal-email">{profile.email}</p>
          </div>
        </div>
        
        <div className="profile-modal-body">
          <h3>Enrolled Subjects</h3>
          {loading ? (
            <div className="profile-loading">Loading courses...</div>
          ) : courses.length > 0 ? (
            <ul className="profile-course-list">
              {courses.map(c => (
                <li key={c.abbr} className="profile-course-item">
                  <span className="course-abbr">{c.abbr}</span>
                  <div className="course-details">
                    <span className="course-name">{c.full_name}</span>
                    <span className="course-faculty">{c.faculty}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="profile-no-courses">No courses enrolled.</p>
          )}
        </div>
        
        <div className="profile-modal-footer">
          <button className="btn-logout" onClick={handleSignOut}>Sign Out</button>
          <button className="btn-delete" onClick={handleDeleteAccount} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete Account'}
          </button>
        </div>
      </div>
    </div>
  )
}
