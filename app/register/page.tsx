'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

type Step = 'details' | 'otp' | 'password'

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('details')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', '', '', ''])
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const stepIndex = step === 'details' ? 0 : step === 'otp' ? 1 : 2

  // Step 1: Validate whitelist + send OTP
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/check-whitelist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), name: name.trim() }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Registration failed.')
      setLoading(false)
      return
    }

    // Send OTP via Supabase
    const supabase = createClient()
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    })

    if (otpError) {
      setError(otpError.message)
      setLoading(false)
      return
    }

    setSuccess('OTP sent to your email. Check your inbox.')
    setStep('otp')
    setLoading(false)
  }

  // Step 2: Verify OTP
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    const token = otp.join('')
    if (token.length !== 8) {
      setError('Please enter the complete 8-digit OTP.')
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token,
      type: 'email',
    })

    if (verifyError) {
      setError('Invalid OTP. Please try again.')
      setLoading(false)
      return
    }

    setStep('password')
    setLoading(false)
  }

  // Step 3: Set password
  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      setLoading(false)
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { error: pwError } = await supabase.auth.updateUser({ password })

    if (pwError) {
      setError(pwError.message)
      setLoading(false)
      return
    }

    // Create user profile
    await fetch('/api/auth/create-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), name: name.trim() }),
    })

    router.push('/dashboard')
    router.refresh()
  }

  // OTP input handlers
  function handleOtpChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return
    const newOtp = [...otp]
    newOtp[index] = value.slice(-1)
    setOtp(newOtp)
    if (value && index < 5) {
      const next = document.getElementById(`otp-${index + 1}`)
      next?.focus()
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prev = document.getElementById(`otp-${index - 1}`)
      prev?.focus()
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 8)
    setOtp(text.split('').concat(Array(8 - text.length).fill('')))
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">🎓</div>
          <div className="auth-logo-text">
            <strong>IIM Rohtak</strong>
            <span>Term IV Portal</span>
          </div>
        </div>

        {/* Step indicator */}
        <div className="step-indicator">
          <div className={`step-dot ${stepIndex >= 0 ? 'active' : ''} ${stepIndex > 0 ? 'done' : ''}`} />
          <div className={`step-dot ${stepIndex >= 1 ? 'active' : ''} ${stepIndex > 1 ? 'done' : ''}`} />
          <div className={`step-dot ${stepIndex >= 2 ? 'active' : ''}`} />
        </div>

        {step === 'details' && (
          <>
            <h1 className="auth-title">PC-V1 Portal</h1>
            <p className="auth-subtitle">Exclusive access for PC-V1 members</p>

            <form className="auth-form" onSubmit={handleSendOtp}>
              {error && <div className="error-msg">{error}</div>}

              <div className="form-group">
                <label className="form-label" htmlFor="reg-name">Full Name</label>
                <input
                  id="reg-name"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Krishnakant Singh"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-email">Email address</label>
                <input
                  id="reg-email"
                  type="email"
                  className="form-input"
                  placeholder="your.email@iimrohtak.ac.in"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-full"
                disabled={loading}
                id="send-otp-btn"
              >
                {loading ? <span className="spinner" /> : null}
                {loading ? 'Verifying…' : 'Send OTP →'}
              </button>
            </form>
          </>
        )}

        {step === 'otp' && (
          <>
            <h1 className="auth-title">Verify your email</h1>
            <p className="auth-subtitle">
              We sent an 8-digit code to <strong style={{ color: 'var(--accent-primary-light)' }}>{email}</strong>
            </p>

            <form className="auth-form" onSubmit={handleVerifyOtp}>
              {error && <div className="error-msg">{error}</div>}
              {success && <div className="success-msg">{success}</div>}

              <div className="otp-inputs">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    id={`otp-${i}`}
                    type="text"
                    inputMode="numeric"
                    className="form-input otp-input"
                    value={digit}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    onPaste={i === 0 ? handleOtpPaste : undefined}
                    maxLength={1}
                    autoComplete="off"
                  />
                ))}
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-full"
                disabled={loading || otp.join('').length < 6}
                id="verify-otp-btn"
              >
                {loading ? <span className="spinner" /> : null}
                {loading ? 'Verifying…' : 'Verify OTP →'}
              </button>
            </form>
          </>
        )}

        {step === 'password' && (
          <>
            <h1 className="auth-title">Set your password</h1>
            <p className="auth-subtitle">Choose a strong password for your account.</p>

            <form className="auth-form" onSubmit={handleSetPassword}>
              {error && <div className="error-msg">{error}</div>}

              <div className="form-group">
                <label className="form-label" htmlFor="new-password">New Password</label>
                <input
                  id="new-password"
                  type="password"
                  className="form-input"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="confirm-password">Confirm Password</label>
                <input
                  id="confirm-password"
                  type="password"
                  className="form-input"
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-full"
                disabled={loading}
                id="set-password-btn"
              >
                {loading ? <span className="spinner" /> : null}
                {loading ? 'Setting up…' : '✓ Complete Registration'}
              </button>
            </form>
          </>
        )}

        <div className="auth-switch">
          Already have an account?{' '}
          <Link href="/login">Sign in</Link>
        </div>
      </div>
    </div>
  )
}
