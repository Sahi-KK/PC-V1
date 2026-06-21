'use client'

const CalendarIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>
)

const ProcessIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
  </svg>
)

const ProfileIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
)

const MiscIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="1"></circle>
    <circle cx="19" cy="12" r="1"></circle>
    <circle cx="5" cy="12" r="1"></circle>
  </svg>
)

const AIIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a2 2 0 0 1 2 2c0 1.1-.9 2-2 2a2 2 0 0 1-2-2c0-1.1.9-2 2-2z" />
    <path d="M19 12a2 2 0 0 1-2-2c0-1.1.9-2 2-2a2 2 0 0 1 2 2c0 1.1-.9 2-2 2z" />
    <path d="M5 12a2 2 0 0 1 2-2c0-1.1-.9-2-2-2a2 2 0 0 1-2 2c0 1.1.9 2 2 2z" />
    <path d="M12 22a2 2 0 0 1-2-2c0-1.1.9-2 2-2a2 2 0 0 1 2 2c0 1.1-.9 2-2 2z" />
    <path d="m10 6.5 4 11" />
    <path d="m14 6.5-4 11" />
  </svg>
)

export default function MobileNav({ activeTab, onChange }: { activeTab: string, onChange: (tab: string) => void }) {
  return (
    <nav className="mobile-nav">
      <button 
        className={`mobile-nav-item ${activeTab === 'home' ? 'active' : ''}`}
        onClick={() => onChange('home')}
      >
        <span className="mobile-nav-icon"><CalendarIcon /></span>
        <span>Home</span>
      </button>
      <button 
        className={`mobile-nav-item ${activeTab === 'process' ? 'active' : ''}`}
        onClick={() => onChange('process')}
      >
        <span className="mobile-nav-icon"><ProcessIcon /></span>
        <span>Process Date</span>
      </button>
      <button 
        className={`mobile-nav-item ${activeTab === 'misc' ? 'active' : ''}`}
        onClick={() => onChange('misc')}
      >
        <span className="mobile-nav-icon"><MiscIcon /></span>
        <span>Misc</span>
      </button>
      <button 
        className={`mobile-nav-item ${activeTab === 'ai' ? 'active' : ''}`}
        onClick={() => onChange('ai')}
      >
        <span className="mobile-nav-icon"><AIIcon /></span>
        <span>AI</span>
      </button>
      <button 
        className={`mobile-nav-item ${activeTab === 'profile' ? 'active' : ''}`}
        onClick={() => onChange('profile')}
      >
        <span className="mobile-nav-icon"><ProfileIcon /></span>
        <span>Profile</span>
      </button>
    </nav>
  )
}
