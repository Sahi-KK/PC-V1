'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

import HomeTab from '@/components/dashboard/HomeTab'
import ProcessTab from '@/components/dashboard/ProcessTab'
import MiscTab from '@/components/dashboard/MiscTab'
import AITab from '@/components/dashboard/AITab'
import ProfileTab from '@/components/dashboard/ProfileTab'
import MobileNav from '@/components/MobileNav'
import NotificationBell from '@/components/dashboard/NotificationBell'

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [activeTab, setActiveTab] = useState('home')
  const [isAuthChecking, setIsAuthChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/login')
      } else {
        setIsAuthChecking(false)
      }
    })
  }, [])

  if (isAuthChecking) {
    return (
      <div className="dashboard">
        <div className="loading-full"><div className="spinner" /></div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      {/* Mobile Header */}
      <header className="mobile-header">
        <div className="mobile-header-logo">
          <img src="/Logo.jpeg" alt="IIM Rohtak Logo" className="topbar-logo-img" />
          <span className="topbar-logo-name" style={{ marginLeft: '12px' }}>PC-V1 Portal</span>
        </div>
        <div className="mobile-header-right" style={{ display: 'flex', alignItems: 'center', paddingRight: '16px' }}>
          <NotificationBell />
        </div>
      </header>

      {/* Main content - Instant Switcher */}
      <main className="page-content" style={{ paddingBottom: '120px' }}>
        <div style={{ display: activeTab === 'home' ? 'block' : 'none' }}>
          <HomeTab />
        </div>
        {activeTab === 'process' && <ProcessTab />}
        {activeTab === 'misc' && <MiscTab />}
        {activeTab === 'ai' && <AITab />}
        {activeTab === 'profile' && <ProfileTab />}
      </main>

      {/* Bottom Nav */}
      <MobileNav activeTab={activeTab} onChange={setActiveTab} />
    </div>
  )
}
