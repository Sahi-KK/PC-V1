'use client'

import Link from 'next/link'
import { CalendarClock, Banknote, CalendarDays, Users, FolderOpen } from 'lucide-react'

export default function MiscTab() {
  const tools = [
    {
      href: "/dashboard/meetings",
      icon: <CalendarDays size={26} strokeWidth={2} style={{ color: '#0ea5e9' }} />,
      bg: 'rgba(14, 165, 233, 0.1)',
      title: "Find Meeting Slots",
      description: "Discover common free times across multiple students effortlessly."
    },
    {
      href: "/dashboard/expenses",
      icon: <Banknote size={26} strokeWidth={2} style={{ color: '#10b981' }} />,
      bg: 'rgba(16, 185, 129, 0.1)',
      title: "Shared Expenses",
      description: "Manage and split costs with your batchmates transparently."
    },
    {
      href: "/dashboard/process",
      icon: <CalendarClock size={26} strokeWidth={2} style={{ color: '#f59e0b' }} />,
      bg: 'rgba(245, 158, 11, 0.1)',
      title: "Process Date",
      description: "Calculate relative dates based on term schedule and deadlines."
    },
    {
      href: "/dashboard/materials",
      icon: <FolderOpen size={26} strokeWidth={2} style={{ color: '#8b5cf6' }} />,
      bg: 'rgba(139, 92, 246, 0.1)',
      title: "Course Materials",
      description: "Access shared case studies, datasets, and presentation slides."
    },
    {
      href: "/dashboard/spocs",
      icon: <Users size={26} strokeWidth={2} style={{ color: '#ec4899' }} />,
      bg: 'rgba(236, 72, 153, 0.1)',
      title: "SPOC Directory",
      description: "Find the Student Point of Contact assigned for each course."
    }
  ]

  return (
    <>
      <div style={{ marginBottom: '24px' }}>
        <h1 className="page-title" style={{ marginBottom: '8px' }}>Miscellaneous</h1>
        <p className="page-subtitle">Premium tools and resources for your academic term.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
        {tools.map((tool, idx) => (
          <Link key={idx} href={tool.href} style={{ textDecoration: 'none', display: 'block' }}>
            <div 
              style={{
                background: 'var(--bg-card)', 
                padding: '24px', 
                borderRadius: 'var(--radius-xl)',
                boxShadow: 'var(--shadow-card)', 
                border: '1px solid var(--border-subtle)',
                display: 'flex', 
                alignItems: 'center', 
                gap: '20px', 
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 12px 24px -10px rgba(0,0,0,0.1)'
                e.currentTarget.style.borderColor = 'var(--accent-primary)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'var(--shadow-card)'
                e.currentTarget.style.borderColor = 'var(--border-subtle)'
              }}
            >
              <div style={{
                width: '56px', 
                height: '56px', 
                borderRadius: '16px', 
                background: tool.bg,
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {tool.icon}
              </div>
              <div>
                <h2 style={{ 
                  fontSize: '17px', 
                  fontWeight: 600, 
                  color: 'var(--text-primary)', 
                  marginBottom: '6px',
                  letterSpacing: '-0.01em'
                }}>
                  {tool.title}
                </h2>
                <p style={{ 
                  fontSize: '14px', 
                  color: 'var(--text-secondary)', 
                  margin: 0,
                  lineHeight: '1.4'
                }}>
                  {tool.description}
                </p>
              </div>
              <div style={{ marginLeft: 'auto', color: 'var(--text-tertiary)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  )
}
