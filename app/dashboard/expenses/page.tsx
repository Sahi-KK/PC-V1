'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  
  const [showCreate, setShowCreate] = useState(false)
  const [description, setDescription] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [splitMode, setSplitMode] = useState<'all' | 'custom'>('all')
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({})

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)

    if (user) {
      const usersRes = await fetch('/api/users')
      const usersData = await usersRes.json()
      setUsers(usersData.users || [])
      const res = await fetch('/api/expenses')
      const data = await res.json()
      setExpenses(data.expenses || [])
    }
    setLoading(false)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description || !totalAmount) return

    let splits = []
    const total = parseFloat(totalAmount)

    if (splitMode === 'all') {
      const selectedArr = Array.from(selectedUsers)
      const perPerson = total / selectedArr.length
      splits = selectedArr.map(id => ({ user_id: id, amount_owed: perPerson }))
    } else {
      splits = Object.entries(customAmounts).map(([id, amt]) => ({
        user_id: id, amount_owed: parseFloat(amt) || 0
      })).filter(s => s.amount_owed > 0)
    }

    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, total_amount: total, splits })
      })
      if (res.ok) {
        setShowCreate(false)
        setDescription(''); setTotalAmount(''); setSelectedUsers(new Set()); setCustomAmounts({})
        fetchData()
      } else alert('Failed to create expense')
    } catch (err) { console.error(err) }
  }

  const handleMarkPaid = async (splitId: string) => {
    if (!confirm('Mark this as paid?')) return
    const res = await fetch('/api/expenses/pay', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ split_id: splitId })
    })
    if (res.ok) fetchData()
    else alert('Failed to mark as paid')
  }

  const handleDelete = async (expenseId: string) => {
    if (!confirm('Are you sure you want to delete this expense? This cannot be undone.')) return
    const res = await fetch('/api/expenses', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: expenseId })
    })
    if (res.ok) fetchData()
    else alert('Failed to delete expense')
  }

  const toggleUser = (id: string) => {
    const newSet = new Set(selectedUsers)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedUsers(newSet)
  }

  const selectAll = () => setSelectedUsers(new Set(users.map(u => u.id)))
  const clearAll = () => setSelectedUsers(new Set())

  let totalOwedByMe = 0
  let totalOwedToMe = 0

  expenses.forEach(exp => {
    if (exp.paid_by === currentUser?.id) {
      exp.expense_splits.forEach((split: any) => {
        if (split.user_id !== currentUser?.id && !split.is_paid) totalOwedToMe += split.amount_owed
      })
    } else {
      const mySplit = exp.expense_splits.find((s: any) => s.user_id === currentUser?.id)
      if (mySplit && !mySplit.is_paid) totalOwedByMe += mySplit.amount_owed
    }
  })

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>

  return (
    <div className="page-content" style={{ paddingBottom: '140px' }}>
      <Link href="/dashboard" className="btn btn-ghost" style={{ marginBottom: '24px', padding: '8px 16px', borderRadius: 'var(--radius-md)', display: 'inline-block' }}>
        ← Back to Dashboard
      </Link>
      
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px', gap: '16px' }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1 className="page-title">Shared Expenses</h1>
          <p className="page-subtitle">Track shared expenses and settle up.</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn btn-primary" style={{ padding: '10px 20px', borderRadius: 'var(--radius-lg)' }}>
          {showCreate ? 'Cancel' : '+ Add Expense'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '24px', borderRadius: 'var(--radius-xl)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <p style={{ color: 'var(--accent-danger)', fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>You Owe</p>
          <p style={{ fontSize: '32px', fontWeight: 800, color: 'var(--accent-danger)' }}>₹{totalOwedByMe.toFixed(2)}</p>
        </div>
        <div style={{ background: 'var(--accent-primary-glow)', padding: '24px', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-active)' }}>
          <p style={{ color: 'var(--accent-primary)', fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>You are Owed</p>
          <p style={{ fontSize: '32px', fontWeight: 800, color: 'var(--accent-primary)' }}>₹{totalOwedToMe.toFixed(2)}</p>
        </div>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} style={{ background: 'var(--bg-glass)', padding: '24px', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>Add New Expense</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Description</label>
              <input type="text" required value={description} onChange={e => setDescription(e.target.value)} style={{ padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', width: '100%', background: 'var(--bg-primary)' }} placeholder="e.g. Pizza" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Total Amount (₹)</label>
              <input type="number" required value={totalAmount} onChange={e => setTotalAmount(e.target.value)} style={{ padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', width: '100%', background: 'var(--bg-primary)' }} placeholder="e.g. 500" />
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Split Mode</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="radio" checked={splitMode === 'all'} onChange={() => setSplitMode('all')} />
                <span style={{ fontSize: '14px', fontWeight: 500 }}>Split Equally</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="radio" checked={splitMode === 'custom'} onChange={() => setSplitMode('custom')} />
                <span style={{ fontSize: '14px', fontWeight: 500 }}>Custom Amounts</span>
              </label>
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: '12px', gap: '8px' }}>
              <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Select People Involved</label>
              {splitMode === 'all' && (
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button type="button" onClick={selectAll} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>Select All</button>
                  <button type="button" onClick={clearAll} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>Clear</button>
                </div>
              )}
            </div>
            
            {splitMode === 'all' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px' }}>
                {users.map(u => {
                  const isSelected = selectedUsers.has(u.id)
                  return (
                    <div key={u.id} onClick={() => toggleUser(u.id)} style={{ padding: '10px', borderRadius: 'var(--radius-md)', border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)'}`, background: isSelected ? 'var(--accent-primary-glow)' : 'var(--bg-surface)', cursor: 'pointer', fontSize: '13px', fontWeight: 500, textAlign: 'center', color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                      {u.name.split(' ')[0]}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {users.map(u => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ width: '120px', fontSize: '14px', fontWeight: 500 }}>{u.name.split(' ')[0]}</span>
                    <input type="number" placeholder="₹ Amount" value={customAmounts[u.id] || ''} onChange={e => setCustomAmounts({...customAmounts, [u.id]: e.target.value})} style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', width: '100px', fontSize: '14px' }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', borderRadius: 'var(--radius-lg)' }}>Save Expense</button>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {expenses.map(exp => {
          const isCreator = exp.paid_by === currentUser?.id
          
          return (
            <div key={exp.id} style={{ background: 'var(--bg-glass)', padding: '20px', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)', overflowX: 'hidden' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', gap: '12px' }}>
                <div style={{ wordBreak: 'break-word', minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>{exp.description}</h3>
                    {isCreator && (
                      <button onClick={() => handleDelete(exp.id)} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                        DELETE
                      </button>
                    )}
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Paid by {isCreator ? 'You' : exp.user_profiles?.name} on {exp.date}</p>
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', flexShrink: 0 }}>
                  ₹{exp.total_amount}
                </div>
              </div>

              <div style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', overflowX: 'auto' }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border-subtle)' }}>Splits Details</p>
                {exp.expense_splits.map((split: any) => {
                  const user = users.find(u => u.id === split.user_id)
                  const isMe = split.user_id === currentUser?.id
                  return (
                    <div key={split.id} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', gap: '8px' }}>
                      <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{isMe ? 'You' : user?.name}</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600 }}>₹{split.amount_owed.toFixed(2)}</span>
                        {split.is_paid ? (
                          <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#047857', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>PAID</span>
                        ) : (
                          <>
                            <span style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>PENDING</span>
                            {isCreator && !isMe && (
                              <button onClick={() => handleMarkPaid(split.id)} style={{ background: 'var(--accent-primary-glow)', color: 'var(--accent-primary)', border: '1px solid var(--border-active)', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                                MARK PAID
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
        {expenses.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>No expenses found. Add one above!</div>
        )}
      </div>
    </div>
  )
}
