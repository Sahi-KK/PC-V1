import ProcessTab from '@/components/dashboard/ProcessTab'

export default function ProcessPage() {
  return (
    <div className="dashboard">
      <header className="mobile-header">
        <a href="/dashboard" style={{ textDecoration: 'none', color: 'var(--text-primary)', fontSize: '24px', marginRight: '16px' }}>←</a>
        <div className="mobile-header-logo">
          <span className="topbar-logo-name">Process Date</span>
        </div>
      </header>
      <main className="page-content" style={{ paddingBottom: '40px' }}>
        <ProcessTab />
      </main>
    </div>
  )
}
