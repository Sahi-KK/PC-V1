'use client'

export const dynamic = 'force-dynamic'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

function SuccessContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const course = searchParams.get('course')
  const time = searchParams.get('time')

  if (error) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>Action Failed</h1>
        <p style={{ color: 'var(--accent-danger)', marginBottom: '24px' }}>{error}</p>
        <Link href="/dashboard" style={{ color: 'var(--accent-primary)', fontWeight: 600, textDecoration: 'none' }}>Go to Dashboard</Link>
      </div>
    )
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
      <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>Attendance Marked</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '15px' }}>
        You have successfully been marked as present for <strong style={{color: 'var(--text-primary)'}}>{course}</strong> at {time}.
      </p>
      <Link href="/dashboard" style={{ 
        display: 'inline-block',
        background: 'var(--accent-primary)', color: 'white', 
        padding: '12px 24px', borderRadius: '8px', 
        fontWeight: 600, textDecoration: 'none' 
      }}>
        Return to Dashboard
      </Link>
    </div>
  )
}

export default function AttendanceSuccessPage() {
  return (
    <div className="dashboard" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        background: 'var(--bg-card)', padding: '40px 32px', borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-subtle)', maxWidth: '400px', width: '90%'
      }}>
        <Suspense fallback={<div>Loading...</div>}>
          <SuccessContent />
        </Suspense>
      </div>
    </div>
  )
}
