'use client'

import { Calendar, CheckSquare, Grid, Sparkles, User } from 'lucide-react'

export default function MobileNav({ activeTab, onChange }: { activeTab: string, onChange: (tab: string) => void }) {
  return (
    <nav className="mobile-nav">
      <button 
        className={`mobile-nav-item ${activeTab === 'home' ? 'active' : ''}`}
        onClick={() => onChange('home')}
      >
        <span className="mobile-nav-icon"><Calendar size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} /></span>
        <span>Home</span>
      </button>
      <button 
        className={`mobile-nav-item ${activeTab === 'todo' ? 'active' : ''}`}
        onClick={() => onChange('todo')}
      >
        <span className="mobile-nav-icon"><CheckSquare size={24} strokeWidth={activeTab === 'todo' ? 2.5 : 2} /></span>
        <span>To-Do List</span>
      </button>
      <button 
        className={`mobile-nav-item ${activeTab === 'misc' ? 'active' : ''}`}
        onClick={() => onChange('misc')}
      >
        <span className="mobile-nav-icon"><Grid size={24} strokeWidth={activeTab === 'misc' ? 2.5 : 2} /></span>
        <span>Misc</span>
      </button>
      <button 
        className={`mobile-nav-item ${activeTab === 'ai' ? 'active' : ''}`}
        onClick={() => onChange('ai')}
      >
        <span className="mobile-nav-icon"><Sparkles size={24} strokeWidth={activeTab === 'ai' ? 2.5 : 2} /></span>
        <span>AI</span>
      </button>
      <button 
        className={`mobile-nav-item ${activeTab === 'profile' ? 'active' : ''}`}
        onClick={() => onChange('profile')}
      >
        <span className="mobile-nav-icon"><User size={24} strokeWidth={activeTab === 'profile' ? 2.5 : 2} /></span>
        <span>Profile</span>
      </button>
    </nav>
  )
}
