'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'

interface Todo {
  id: string
  title: string
  description: string | null
  event_date: string
  start_time: string
}

const PlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
)

const TrashIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18"></path>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
)

const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>
)

const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
)

export default function TodoTab() {
  const supabase = createClient()
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [overlapError, setOverlapError] = useState('')

  const fetchTodos = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', user.id)
      .order('event_date', { ascending: true })
      .order('start_time', { ascending: true })

    if (data) setTodos(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchTodos()
    // Set default date to today
    const today = new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})
    const todayDate = new Date(today)
    const dateStr = todayDate.getFullYear() + '-' + String(todayDate.getMonth() + 1).padStart(2, '0') + '-' + String(todayDate.getDate()).padStart(2, '0')
    setDate(dateStr)
  }, [])

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !date || !time) return

    setIsSubmitting(true)
    setOverlapError('')
    
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      // OVERLAP CHECK
      const { data: profile } = await supabase.from('profiles').select('section').eq('id', user.id).single()
      const { data: classes } = await supabase.from('calendar_entries').select('time_slot, class_code, section').eq('date', date)
      
      if (profile && classes) {
        const userSection = profile.section
        const myClasses = classes.filter(c => c.section === userSection)
        
        const toMins = (t: string) => {
          const [h, m] = t.split(':').map(Number)
          return h * 60 + m
        }
        
        const eventMins = toMins(time)
        let conflictClass = null
        
        for (const c of myClasses) {
          if (!c.time_slot || c.time_slot === 'LUNCH') continue
          const [startStr, endStr] = c.time_slot.split('-')
          if (!startStr || !endStr) continue
          
          if (eventMins >= toMins(startStr) && eventMins <= toMins(endStr)) {
            conflictClass = c.class_code
            break
          }
        }
        
        if (conflictClass) {
          setOverlapError(`This time overlaps with your scheduled class: ${conflictClass}`)
          setIsSubmitting(false)
          return
        }
      }

      await supabase.from('todos').insert({
        user_id: user.id,
        title,
        description,
        event_date: date,
        start_time: time
      })
      setTitle('')
      setDescription('')
      setTime('')
      setShowForm(false)
      fetchTodos()
    }
    setIsSubmitting(false)
  }

  const handleDelete = async (id: string) => {
    await supabase.from('todos').delete().eq('id', id)
    fetchTodos()
  }

  if (loading) {
    return (
      <div style={{ padding: '0', animation: 'fadeIn 0.3s ease-out' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <div className="skeleton" style={{ height: '32px', width: '150px', marginBottom: '8px', borderRadius: '8px' }} />
            <div className="skeleton" style={{ height: '16px', width: '250px', borderRadius: '4px' }} />
          </div>
          <div className="skeleton" style={{ width: '48px', height: '48px', borderRadius: '50%' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: '100px', borderRadius: '16px', opacity: 1 - (i * 0.15) }} />)}
        </div>
      </div>
    )
  }

  // Group Todos
  const todayStr = new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})
  const todayDate = new Date(todayStr)
  const todayYYYYMMDD = todayDate.getFullYear() + '-' + String(todayDate.getMonth() + 1).padStart(2, '0') + '-' + String(todayDate.getDate()).padStart(2, '0')
  
  const tomorrowDate = new Date(todayDate)
  tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const tomorrowYYYYMMDD = tomorrowDate.getFullYear() + '-' + String(tomorrowDate.getMonth() + 1).padStart(2, '0') + '-' + String(tomorrowDate.getDate()).padStart(2, '0')

  const todayTodos = todos.filter(t => t.event_date === todayYYYYMMDD)
  const tomorrowTodos = todos.filter(t => t.event_date === tomorrowYYYYMMDD)
  const upcomingTodos = todos.filter(t => t.event_date > tomorrowYYYYMMDD)
  const pastTodos = todos.filter(t => t.event_date < todayYYYYMMDD)

  const renderTodoCard = (todo: Todo) => {
    // Format time from HH:MM:SS to HH:MM AM/PM
    const [h, m] = todo.start_time.split(':')
    const dateObj = new Date()
    dateObj.setHours(parseInt(h), parseInt(m))
    const formattedTime = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    
    return (
      <div key={todo.id} className="todo-card" style={{
        background: 'var(--bg-card)', 
        padding: '20px', 
        borderRadius: '16px', 
        border: '1px solid var(--border-subtle)', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        marginBottom: '12px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Subtle decorative left border */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: 'var(--primary)' }} />
        
        <div style={{ paddingLeft: '8px' }}>
          <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>{todo.title}</h3>
          {todo.description && <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 12px 0', lineHeight: 1.4 }}>{todo.description}</p>}
          <div style={{ display: 'flex', gap: '12px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(59,130,246,0.08)', color: 'var(--primary)', padding: '6px 10px', borderRadius: '8px' }}>
              <CalendarIcon /> {todo.event_date}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981', padding: '6px 10px', borderRadius: '8px' }}>
              <ClockIcon /> {formattedTime}
            </span>
          </div>
        </div>
        <button 
          onClick={() => handleDelete(todo.id)} 
          style={{ 
            background: 'transparent', 
            color: 'var(--text-muted)', 
            border: 'none', 
            width: '36px', 
            height: '36px', 
            borderRadius: '10px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            cursor: 'pointer',
            transition: 'background 0.2s, color 0.2s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = '#ef4444' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
        >
          <TrashIcon />
        </button>
      </div>
    )
  }

  const renderSection = (title: string, items: Todo[]) => {
    if (items.length === 0) return null
    return (
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '16px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
          {title} <span style={{ background: 'var(--border-subtle)', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', color: 'var(--text-primary)', marginLeft: '8px' }}>{items.length}</span>
        </h2>
        <div>{items.map(renderTodoCard)}</div>
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: '4px' }}>To-Do List</h1>
          <p className="page-subtitle">Your personal schedule & tasks.</p>
        </div>
        {!showForm && (
          <button 
            onClick={() => setShowForm(true)}
            style={{ 
              background: 'var(--primary)', color: 'white', border: 'none', 
              borderRadius: '50%', width: '48px', height: '48px', 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(59,130,246,0.3)', cursor: 'pointer',
              transition: 'transform 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <PlusIcon />
          </button>
        )}
      </div>

      {showForm && (
        <div style={{ 
          background: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-xl)', 
          boxShadow: 'var(--shadow-card)', border: '1px solid var(--border-subtle)', 
          marginBottom: '32px', animation: 'slideDown 0.3s ease-out forwards' 
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Create New Task</h2>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: '24px', color: 'var(--text-muted)', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
          </div>

          {overlapError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              {overlapError}
            </div>
          )}
          
          <form onSubmit={handleAddTodo} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>What needs to be done?</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} required 
                style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: 'var(--bg-body)', color: 'var(--text-primary)', fontSize: '15px' }} 
                placeholder="E.g., Complete strategy assignment" autoFocus />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Details (Optional)</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
                style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: 'var(--bg-body)', color: 'var(--text-primary)', fontSize: '15px', resize: 'vertical' }} 
                placeholder="Add meeting links, room numbers, etc..." />
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} required 
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: 'var(--bg-body)', color: 'var(--text-primary)', fontSize: '15px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Start Time</label>
                <input type="time" value={time} onChange={e => setTime(e.target.value)} required 
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: 'var(--bg-body)', color: 'var(--text-primary)', fontSize: '15px' }} />
              </div>
            </div>
            <button type="submit" disabled={isSubmitting} 
              style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '14px', borderRadius: '12px', fontWeight: 600, fontSize: '16px', marginTop: '8px', cursor: 'pointer', transition: 'background 0.2s', opacity: isSubmitting ? 0.7 : 1 }}>
              {isSubmitting ? 'Saving Task...' : 'Save Task'}
            </button>
          </form>
        </div>
      )}

      {todos.length === 0 && !showForm ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg-card)', borderRadius: '24px', border: '1px dashed var(--border-subtle)' }}>
          <div style={{ width: '64px', height: '64px', background: 'rgba(59,130,246,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', color: 'var(--primary)' }}>
            <CalendarIcon />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>You're all caught up!</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '250px', margin: '0 auto 24px auto' }}>You have no upcoming tasks. Enjoy your free time or add a new task.</p>
          <button 
            onClick={() => setShowForm(true)}
            style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
            + Create a Task
          </button>
        </div>
      ) : (
        <div>
          {renderSection('Today', todayTodos)}
          {renderSection('Tomorrow', tomorrowTodos)}
          {renderSection('Upcoming', upcomingTodos)}
          {renderSection('Past Tasks', pastTodos)}
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  )
}
