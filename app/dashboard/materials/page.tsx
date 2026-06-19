'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

interface CourseMaterial {
  id: string
  course_abbr: string
  title: string
  description: string
  file_type: string
  drive_url: string
  created_at: string
}

export default function MaterialsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [materials, setMaterials] = useState<CourseMaterial[]>([])
  const [enrollments, setEnrollments] = useState<string[]>([])
  const [selectedCourse, setSelectedCourse] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Get profile and enrollments
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('roll_no')
        .eq('id', user.id)
        .single()

      if (profile) {
        const { data: student } = await supabase
          .from('students')
          .select('id')
          .eq('roll_no', profile.roll_no)
          .single()

        if (student) {
          const { data: enrolled } = await supabase
            .from('student_courses')
            .select('course_abbr')
            .eq('student_id', student.id)
          
          if (enrolled) {
            setEnrollments(enrolled.map(e => e.course_abbr))
          }
        }
      }

      fetchMaterials('', '')
    }
    init()
  }, [])

  async function fetchMaterials(course: string, query: string) {
    setLoading(true)
    const params = new URLSearchParams()
    if (course) params.append('course', course)
    if (query) params.append('q', query)
    
    const res = await fetch(`/api/materials?${params.toString()}`)
    const data = await res.json()
    if (data.materials) {
      setMaterials(data.materials)
    }
    setLoading(false)
  }

  // Handle Search submit
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchMaterials(selectedCourse, searchQuery)
  }

  // Handle Course Filter click
  const handleCourseClick = (course: string) => {
    const newCourse = selectedCourse === course ? '' : course
    setSelectedCourse(newCourse)
    fetchMaterials(newCourse, searchQuery)
  }

  // Helper to pick icon based on file type
  const getFileIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case 'PDF': return '📄'
      case 'EXCEL': return '📊'
      case 'DOC': return '📝'
      default: return '📁'
    }
  }

  return (
    <div className="dashboard">
      <header className="mobile-header">
        <div className="mobile-header-logo">
          <span className="topbar-logo-name">Course Material</span>
        </div>
      </header>

      <main className="page-content" style={{ paddingBottom: '100px' }}>
        <div className="page-header">
          <h1 className="page-title">Course Materials</h1>
          <p className="page-subtitle">Access cases, datasets, and slides for your enrolled subjects.</p>
        </div>

        {/* Search Bar */}
        <div className="search-box-wrapper" style={{ marginBottom: '20px' }}>
          <span className="search-icon">🔍</span>
          <form onSubmit={handleSearch} style={{ width: '100%' }}>
            <input
              type="text"
              className="search-input"
              placeholder="Search materials by title or keyword..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </form>
        </div>

        {/* Course Filter Strip */}
        {enrollments.length > 0 && (
          <div className="enrolled-courses-strip" style={{ marginBottom: '24px' }}>
            {enrollments.map((course) => (
              <div 
                key={course} 
                className={`enrolled-badge ${selectedCourse === course ? 'active' : ''}`}
                onClick={() => handleCourseClick(course)}
                style={{
                  cursor: 'pointer',
                  background: selectedCourse === course ? 'var(--accent-primary)' : 'var(--bg-card)',
                  color: selectedCourse === course ? '#fff' : 'var(--text-primary)',
                  border: `1px solid ${selectedCourse === course ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                  transition: 'all 0.2s'
                }}
              >
                {course}
              </div>
            ))}
          </div>
        )}

        {/* Materials List */}
        {loading ? (
          <div className="loading-full"><div className="spinner" />Loading materials...</div>
        ) : materials.length === 0 ? (
          <div className="no-classes">
            <div className="no-classes-icon">📁</div>
            <div className="no-classes-text">No materials found</div>
            <div className="no-classes-sub">Try adjusting your search or course filter.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {materials.map(mat => (
              <a 
                href={mat.drive_url} 
                target="_blank" 
                rel="noreferrer"
                key={mat.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px',
                  background: 'var(--bg-card)',
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-sm)',
                  border: '1px solid var(--border-subtle)',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseOut={e => e.currentTarget.style.transform = 'none'}
              >
                <div style={{ fontSize: '24px', background: 'var(--bg-body)', padding: '12px', borderRadius: '12px' }}>
                  {getFileIcon(mat.file_type)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-primary)', background: 'rgba(59, 130, 246, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                      {mat.course_abbr}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{mat.file_type}</span>
                  </div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{mat.title}</h3>
                  {mat.description && <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{mat.description}</p>}
                </div>
                <div style={{ color: 'var(--text-muted)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                </div>
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
