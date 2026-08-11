'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { ThemeToggle } from '@/components/theme/theme-toggle'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await apiClient.login({ email, password })
      router.push('/')
      router.refresh()
    } catch (err) {
      setError((err as Error).message || 'Sign-in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="signin-page">
      <div style={{ position: 'fixed', top: 16, right: 16 }}>
        <ThemeToggle />
      </div>
      <section className="signin-card">
        <div className="signin-brand">
          <span className="brand-mark">T</span>
          <span>Talocode Cloud</span>
        </div>
        <h1>Sign in</h1>
        <p className="lead">
          Manage projects, API keys, wallet credits, and usage for hosted Talocode product APIs.
        </p>
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error ? <p className="alert error" role="alert">{error}</p> : null}
          <button className="btn primary" style={{ width: '100%', marginTop: 8 }} disabled={loading} type="submit">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p style={{ marginTop: 20, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
          API base: {process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.talocode.site'}
        </p>
      </section>
    </main>
  )
}
