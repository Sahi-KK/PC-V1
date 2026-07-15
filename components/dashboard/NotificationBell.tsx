'use client'

import { useState, useEffect, useRef } from 'react'

interface Notification {
  id: string
  title: string
  message: string
  action_url: string
  is_read: boolean
  created_at: string
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications')
      const data = await res.json()
      if (data.notifications) {
        setNotifications(data.notifications)
        setUnreadCount(data.notifications.filter((n: Notification) => !n.is_read).length)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const subscribeUserToPush = async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      const vapidRes = await fetch('/api/notifications/vapid')
      const { publicKey } = await vapidRes.json()

      // Check existing subscription
      const existingSub = await reg.pushManager.getSubscription()
      if (existingSub) {
        // Unsubscribe the old one to force a refresh with the new VAPID key
        await existingSub.unsubscribe()
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      })

      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription })
      })
    } catch (e) {
      console.error('Push Subscription failed', e)
    }
  }

  const markAsRead = async (id?: string) => {
    await fetch('/api/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(id ? { notification_id: id } : { mark_all: true })
    })
    fetchNotifications()
  }

  const toggleDropdown = () => {
    setIsOpen(!isOpen)
  }

  useEffect(() => {
    fetchNotifications()

    // Request Notification permission for Web Push
    if ('Notification' in window && 'serviceWorker' in navigator) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            subscribeUserToPush()
          }
        })
      } else if (Notification.permission === 'granted') {
        subscribeUserToPush()
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="notification-bell-container" ref={dropdownRef} style={{ position: 'relative' }}>
      <button onClick={toggleDropdown} style={{ background: 'transparent', border: 'none', cursor: 'pointer', position: 'relative' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '-4px', right: '-4px', 
            background: 'red', color: 'white', borderRadius: '50%',
            padding: '2px 6px', fontSize: '10px', fontWeight: 'bold'
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', top: '40px', right: '0', 
          width: '300px', maxHeight: '400px', overflowY: 'auto',
          background: 'white', borderRadius: '8px', 
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 1000
        }}>
          <div style={{ padding: '12px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
            <h4 style={{ margin: 0 }}>Notifications</h4>
            {unreadCount > 0 && (
              <button onClick={() => markAsRead()} style={{ fontSize: '12px', color: '#0070f3', background: 'none', border: 'none', cursor: 'pointer' }}>Mark all read</button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: '#666' }}>No notifications</div>
          ) : (
            notifications.map(n => (
              <div 
                key={n.id} 
                onClick={() => !n.is_read && markAsRead(n.id)}
                style={{ 
                  padding: '12px', 
                  borderBottom: '1px solid #eee', 
                  background: n.is_read ? 'white' : '#f0f7ff',
                  cursor: n.is_read ? 'default' : 'pointer'
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#333' }}>{n.title}</div>
                <div style={{ fontSize: '13px', color: '#555', marginTop: '4px' }}>{n.message}</div>
                <div style={{ fontSize: '11px', color: '#999', marginTop: '6px' }}>
                  {new Date(n.created_at).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
