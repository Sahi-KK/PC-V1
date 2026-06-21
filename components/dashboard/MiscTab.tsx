'use client'

import Link from 'next/link'

export default function MiscTab() {
  return (
    <>
      <div style={{ marginBottom: '24px' }}>
        <h1 className="page-title" style={{ marginBottom: '8px' }}>Miscellaneous</h1>
        <p className="page-subtitle">Tools and resources for your academic term.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
        <Link href="/dashboard/meetings" style={{ textDecoration: 'none' }}>
          <div style={{
            background: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-card)', border: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', gap: '16px', transition: 'var(--transition)'
          }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(14, 165, 233, 0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px'
            }}>
              📅
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Find Meeting Slots</h2>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>Discover common free times across multiple students.</p>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/expenses" style={{ textDecoration: 'none' }}>
          <div style={{
            background: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-card)', border: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', gap: '16px', transition: 'var(--transition)'
          }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px'
            }}>
              💸
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Shared Expenses</h2>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>Manage and split costs with your batchmates.</p>
            </div>
          </div>
        </Link>
      </div>
    </>
  )
}
