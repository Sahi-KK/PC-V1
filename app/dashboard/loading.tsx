import React from 'react'

export default function Loading() {
  return (
    <div style={{ padding: '24px 0', animation: 'fadeIn 0.3s ease-out' }}>
      {/* Header Skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div style={{ width: '100%', maxWidth: '300px' }}>
          <div className="skeleton" style={{ height: '32px', width: '60%', marginBottom: '8px', borderRadius: '8px' }} />
          <div className="skeleton" style={{ height: '20px', width: '80%', borderRadius: '6px' }} />
        </div>
        <div className="skeleton" style={{ height: '40px', width: '120px', borderRadius: '12px' }} />
      </div>

      {/* Main Content Skeleton Area */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
        {/* Card 1 */}
        <div style={{ 
          background: 'var(--bg-card)', 
          padding: '24px', 
          borderRadius: 'var(--radius-xl)', 
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div className="skeleton" style={{ height: '24px', width: '40%', borderRadius: '6px' }} />
          <div className="skeleton" style={{ height: '16px', width: '100%', borderRadius: '4px' }} />
          <div className="skeleton" style={{ height: '16px', width: '90%', borderRadius: '4px' }} />
          <div className="skeleton" style={{ height: '40px', width: '100%', borderRadius: '8px', marginTop: '8px' }} />
        </div>

        {/* Card 2 */}
        <div style={{ 
          background: 'var(--bg-card)', 
          padding: '24px', 
          borderRadius: 'var(--radius-xl)', 
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          opacity: 0.7
        }}>
          <div className="skeleton" style={{ height: '24px', width: '30%', borderRadius: '6px' }} />
          <div className="skeleton" style={{ height: '16px', width: '80%', borderRadius: '4px' }} />
          <div className="skeleton" style={{ height: '16px', width: '85%', borderRadius: '4px' }} />
        </div>
        
        {/* Card 3 */}
        <div style={{ 
          background: 'var(--bg-card)', 
          padding: '24px', 
          borderRadius: 'var(--radius-xl)', 
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          opacity: 0.4
        }}>
          <div className="skeleton" style={{ height: '24px', width: '50%', borderRadius: '6px' }} />
          <div className="skeleton" style={{ height: '16px', width: '95%', borderRadius: '4px' }} />
        </div>
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
