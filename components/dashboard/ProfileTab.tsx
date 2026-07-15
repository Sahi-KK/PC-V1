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
  const [telegramLinked, setTelegramLinked] = useState(false)
  const [linkingTelegram, setLinkingTelegram] = useState(false)

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
          const abbrs = enrollments?.map((e: {course_abbr: string}) => e.course_abbr).filter((a: string) => a !== 'CW-') || []
          if (abbrs.length > 0) {
            const { data: coursesData } = await supabase.from('courses').select('abbr, full_name, faculty').in('abbr', abbrs)
            if (coursesData) setCourses(coursesData)
          }
        }
      }
      
      const res = await fetch('/api/telegram/link')
      const tgData = await res.json()
      if (tgData.isLinked) setTelegramLinked(true)

      setLoading(false)
    }
    fetchProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleLinkTelegram() {
    setLinkingTelegram(true)
    try {
      const res = await fetch('/api/telegram/link', { method: 'POST' })
      const data = await res.json()
      if (data.link) {
        window.open(data.link, '_blank')
      }
    } catch (e) {
      console.error(e)
    }
    setLinkingTelegram(false)
  }

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
      console.error(e)
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
          background: 'var(--bg-glass)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          padding: '24px', borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-elevated)', marginBottom: '32px', border: '1px solid var(--border-subtle)',
          display: 'flex', gap: '20px', alignItems: 'center', position: 'relative', overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'var(--gradient-primary)' }} />
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
        background: 'var(--bg-glass)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        padding: '24px', borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-elevated)', marginBottom: '32px', border: '1px solid var(--border-subtle)'
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>Enrolled Subjects</h2>
        {courses.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {courses.map(c => (
              <div key={c.abbr} style={{
                padding: '16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)',
                background: 'rgba(255, 255, 255, 0.02)'
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

      <div style={{
        background: 'var(--bg-glass)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        padding: '24px', borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-elevated)', marginBottom: '32px', border: '1px solid var(--border-subtle)'
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>App Features & Use Cases</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {[
            { icon: '📅', title: 'Smart Academic Calendar', desc: 'Automated schedule sync, timezone management, and timeline views.' },
            { icon: '📊', title: 'Attendance Tracker', desc: 'Live tracking of proxies vs. physical presence across all courses.' },
            { icon: '🍽️', title: 'Mess Menu', desc: 'Full weekly mess menu with quick glances at today’s meals.' },
            { icon: '💰', title: 'Expenses Manager', desc: 'Track common shared expenses, late-night canteen bills, or group travel.' },
            { icon: '📚', title: 'Study Materials', desc: 'Centralized access to shared class notes and presentations.' },
            { icon: '🤝', title: 'SPOC Availability', desc: 'Check when student point-of-contacts are available for immediate help.' },
            { icon: '🤖', title: 'AI Assistant', desc: 'Ask campus-related questions and get quick context-aware answers.' },
            { icon: '🔔', title: 'Push Notifications', desc: 'Receive instant alerts for upcoming classes, events, or deadlines.' }
          ].map((feat, i) => (
            <div key={i} style={{
              padding: '16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)',
              background: 'rgba(255, 255, 255, 0.02)', display: 'flex', gap: '12px', alignItems: 'flex-start'
            }}>
              <div style={{ fontSize: '20px', background: 'var(--bg-body)', padding: '8px', borderRadius: 'var(--radius-sm)' }}>{feat.icon}</div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>{feat.title}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.4 }}>{feat.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{
        background: 'var(--bg-glass)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        padding: '24px', borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-elevated)', marginBottom: '32px', border: '1px solid var(--border-subtle)'
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>Notification Settings</h2>
        
        <div style={{
          padding: '16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)',
          background: 'rgba(255, 255, 255, 0.02)', display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ fontSize: '24px', background: 'var(--bg-body)', padding: '8px', borderRadius: 'var(--radius-sm)' }}>📱</div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Telegram Bot Notifications</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Get instant alerts for classes and tasks on Telegram.</div>
            </div>
          </div>
          <button 
            onClick={telegramLinked ? undefined : handleLinkTelegram}
            disabled={linkingTelegram || telegramLinked}
            style={{
              padding: '10px 16px', borderRadius: '8px', border: 'none',
              background: telegramLinked ? 'rgba(16, 185, 129, 0.1)' : 'var(--primary)',
              color: telegramLinked ? '#10b981' : 'white',
              fontWeight: 600, fontSize: '14px', cursor: telegramLinked ? 'default' : 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {telegramLinked ? '✓ Linked' : (linkingTelegram ? 'Generating...' : 'Link Telegram')}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
        <button 
          onClick={handleSignOut}
          style={{
            padding: '16px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)', fontWeight: 600, fontSize: '15px', cursor: 'pointer', textAlign: 'center',
            boxShadow: 'var(--shadow-sm)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)'
          }}
        >
          Sign Out
        </button>
        
        <button 
          onClick={handleDeleteAccount} disabled={deleting}
          style={{
            padding: '16px', borderRadius: 'var(--radius-lg)', background: 'transparent', border: '1px solid rgba(239, 68, 68, 0.3)',
            color: 'var(--accent-danger)', fontWeight: 600, fontSize: '15px', cursor: deleting ? 'not-allowed' : 'pointer', textAlign: 'center'
          }}
        >
          {deleting ? 'Deleting...' : 'Delete Account'}
        </button>
      </div>
    </>
  )
}
