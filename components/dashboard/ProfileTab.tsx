'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

interface Course {
  abbr: string
  full_name: string
  faculty: string
}

export default function ProfileTab() {
  const router = useRouter()
  const supabase = createClient()
  
  const [profile, setProfile] = useState<{ name: string; roll_no: string; email: string } | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const { data: prof } = await supabase.from('user_profiles').select('name, roll_no, email').eq('id', user.id).single()
      if (prof) setProfile(prof)
      
      if (prof?.roll_no) {
        const { data: student } = await supabase.from('students').select('id').eq('roll_no', prof.roll_no).single()
        if (student) {
          const { data: enrollments } = await supabase.from('student_courses').select('course_abbr').eq('student_id', student.id)
          const abbrs = enrollments?.map((e: any) => e.course_abbr).filter((a: string) => a !== 'CW-') || []
          if (abbrs.length > 0) {
            const { data: coursesData } = await supabase.from('courses').select('abbr, full_name, faculty').in('abbr', abbrs)
            if (coursesData) setCourses(coursesData)
          }
        }
      }
      setLoading(false)
    }
    fetchProfile()
  }, [])

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

  if (loading) {
    return (
      <div className="loading-full"><div className="spinner" />Loading profile...</div>
    )
  }

  return (
    <>
      <div style={{ marginBottom: '24px' }}>
        <h1 className="page-title" style={{ marginBottom: '8px' }}>Your Profile</h1>
      </div>

      {profile && (
        <div style={{
          background: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-card)', marginBottom: '32px', border: '1px solid var(--border-subtle)',
          display: 'flex', gap: '20px', alignItems: 'center'
        }}>
          <div style={{
            width: '80px', height: '80px', background: 'var(--gradient-primary)',
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px', fontWeight: 700, color: 'white', flexShrink: 0
          }}>
            {profile.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
          </div>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>{profile.name}</h1>
            <p style={{ fontSize: '15px', color: 'var(--text-secondary)', fontWeight: 500 }}>{profile.roll_no}</p>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{profile.email}</p>
          </div>
        </div>
      )}

      <div style={{
        background: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-card)', marginBottom: '32px', border: '1px solid var(--border-subtle)'
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>Enrolled Subjects</h2>
        {courses.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {courses.map(c => (
              <div key={c.abbr} style={{
                padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-subtle)',
                background: 'var(--bg-body)'
              }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '4px' }}>{c.abbr}</div>
                <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)' }}>{c.full_name}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{c.faculty}</div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No courses enrolled.</p>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <button 
          onClick={handleSignOut}
          style={{
            padding: '14px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)', fontWeight: 600, fontSize: '15px', cursor: 'pointer', textAlign: 'center',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          Sign Out
        </button>
        
        <button 
          onClick={handleDeleteAccount} disabled={deleting}
          style={{
            padding: '14px', borderRadius: '8px', background: 'transparent', border: '1px solid rgba(239, 68, 68, 0.3)',
            color: 'var(--accent-danger)', fontWeight: 600, fontSize: '15px', cursor: deleting ? 'not-allowed' : 'pointer', textAlign: 'center'
          }}
        >
          {deleting ? 'Deleting...' : 'Delete Account'}
        </button>
      </div>
    </>
  )
}
