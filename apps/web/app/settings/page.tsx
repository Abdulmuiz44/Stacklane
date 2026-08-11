'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageScaffold, Panel } from '@/components/app-shell'
import { apiClient } from '@/lib/api-client'
import { formatTimestamp } from '@/lib/format'
import type { User } from '@/lib/api-types'
import { ThemeToggle } from '@/components/theme/theme-toggle'

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    apiClient
      .me()
      .then(setUser)
      .catch((e) => setError((e as Error).message))
  }, [])

  async function logout() {
    try {
      await apiClient.logout()
    } catch {
      /* ignore */
    }
    router.push('/signin')
  }

  return (
    <PageScaffold
      title="Settings"
      subtitle="Account and dashboard preferences."
      breadcrumbs={[{ label: 'Settings' }]}
    >
      {error ? <div className="alert error">{error}</div> : null}

      <div className="grid-2">
        <Panel title="Account">
          {user ? (
            <div className="stack" style={{ gap: 10 }}>
              <div>
                <div className="label" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  Name
                </div>
                <strong>{user.name}</strong>
              </div>
              <div>
                <div className="label" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  Email
                </div>
                <strong>{user.email}</strong>
              </div>
              <div>
                <div className="label" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  Status
                </div>
                <strong>{user.status}</strong>
              </div>
              <div>
                <div className="label" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  Last login
                </div>
                <strong>{formatTimestamp(user.lastLoginAt)}</strong>
              </div>
              <button className="btn danger" type="button" onClick={() => void logout()}>
                Sign out
              </button>
            </div>
          ) : (
            <div className="empty">Loading account…</div>
          )}
        </Panel>

        <Panel title="Appearance">
          <p style={{ marginTop: 0, color: 'var(--text-secondary)' }}>
            Simple dark / light interface. Preference is stored in this browser.
          </p>
          <div className="actions">
            <ThemeToggle />
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Toggle theme</span>
          </div>
        </Panel>
      </div>

      <Panel title="API">
        <div className="stack" style={{ gap: 8 }}>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Public API base</span>
            <div className="mono">https://api.talocode.site</div>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Dashboard client API base</span>
            <div className="mono">{process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'}</div>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Docs</span>
            <div>
              <a href="https://docs.talocode.site" target="_blank" rel="noreferrer">
                docs.talocode.site
              </a>
            </div>
          </div>
        </div>
      </Panel>
    </PageScaffold>
  )
}
