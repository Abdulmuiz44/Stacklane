'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { MetaChip, PageScaffold, Panel, StatusBadge } from '@/components/app-shell'
import { apiClient } from '@/lib/api-client'
import { formatCredits, formatTimestamp, formatUsdFromCredits } from '@/lib/format'
import type { ApiKey, CloudWallet, Project } from '@/lib/api-types'

export default function ProjectDetailPage() {
  const params = useParams<{ slug: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [wallet, setWallet] = useState<CloudWallet | null>(null)
  const [keyName, setKeyName] = useState('default')
  const [secret, setSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (slug: string) => {
    const [p, k] = await Promise.all([apiClient.getProject(slug), apiClient.listProjectApiKeys(slug)])
    setProject(p)
    setKeys(k)
    try {
      setWallet(await apiClient.getCloudWallet(p.id))
    } catch {
      setWallet(null)
    }
  }, [])

  useEffect(() => {
    if (!params.slug) return
    load(params.slug)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [params.slug, load])

  async function createKey(e: FormEvent) {
    e.preventDefault()
    if (!project || keyName.trim().length < 2) return
    setBusy(true)
    setError(null)
    setSecret(null)
    try {
      const result = await apiClient.createProjectApiKey(project.slug, { name: keyName.trim() })
      setSecret(result.secret)
      setKeyName('default')
      await load(project.slug)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function revokeKey(keyId: string) {
    if (!project) return
    if (!confirm('Revoke this API key? Apps using it will stop working.')) return
    setBusy(true)
    setError(null)
    try {
      await apiClient.revokeProjectApiKey(project.slug, keyId)
      await load(project.slug)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function copySecret() {
    if (!secret) return
    await navigator.clipboard.writeText(secret)
  }

  if (loading) {
    return (
      <PageScaffold title="Project" subtitle="Loading…">
        <div className="empty">Loading project…</div>
      </PageScaffold>
    )
  }

  if (!project) {
    return (
      <PageScaffold title="Project not found">
        <div className="alert error">{error || 'Project missing'}</div>
        <Link className="btn" href="/projects">
          Back to projects
        </Link>
      </PageScaffold>
    )
  }

  return (
    <PageScaffold
      title={project.name}
      subtitle={project.description || 'Talocode Cloud project'}
      breadcrumbs={[{ label: 'Projects', href: '/projects' }, { label: project.name }]}
      metadata={
        <>
          <MetaChip label="Slug" value={project.slug} />
          <MetaChip label="Status" value={project.status} />
          {wallet ? <MetaChip label="Balance" value={formatCredits(wallet.balance)} /> : null}
        </>
      }
      actions={
        <>
          <Link className="btn" href="/billing">
            Wallet
          </Link>
          <Link className="btn primary" href="/billing/usage">
            Usage
          </Link>
        </>
      }
    >
      {error ? <div className="alert error">{error}</div> : null}

      <div className="grid-3">
        <div className="stat-card">
          <p className="label">Status</p>
          <p className="value" style={{ fontSize: 18 }}>
            <StatusBadge value={project.status} />
          </p>
          <p className="hint">Org: {project.organization?.name || '—'}</p>
        </div>
        <div className="stat-card">
          <p className="label">Credit balance</p>
          <p className="value">{wallet ? formatCredits(wallet.balance) : '—'}</p>
          <p className="hint">{wallet ? formatUsdFromCredits(wallet.balance) : 'Wallet unavailable'}</p>
        </div>
        <div className="stat-card">
          <p className="label">API keys</p>
          <p className="value">{keys.filter((k) => k.status !== 'revoked').length}</p>
          <p className="hint">Active keys for this project</p>
        </div>
      </div>

      <div className="grid-2">
        <Panel title="Create API key">
          <p style={{ marginTop: 0, color: 'var(--text-secondary)', fontSize: 13 }}>
            Secrets are shown <strong>once</strong>. Store them securely — Talocode cannot show them again.
          </p>
          <form onSubmit={createKey}>
            <div className="field">
              <label htmlFor="keyName">Key name</label>
              <input
                id="keyName"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="production"
                minLength={2}
                required
              />
            </div>
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? 'Creating…' : 'Create key'}
            </button>
          </form>
          {secret ? (
            <div style={{ marginTop: 16 }}>
              <div className="alert success">Copy this secret now — it will not be shown again.</div>
              <div className="secret-box" style={{ marginTop: 10 }}>
                {secret}
              </div>
              <button className="btn" type="button" style={{ marginTop: 10 }} onClick={() => void copySecret()}>
                Copy secret
              </button>
            </div>
          ) : null}
        </Panel>

        <Panel title="Auth example">
          <p style={{ marginTop: 0, color: 'var(--text-secondary)', fontSize: 13 }}>
            Use your key with any Talocode product namespace:
          </p>
          <pre
            className="secret-box"
            style={{ whiteSpace: 'pre-wrap' }}
          >{`curl https://api.talocode.site/v1/tera/chat/completions \\
  -H "Authorization: Bearer YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"talocode/auto","messages":[{"role":"user","content":"hello"}]}'`}</pre>
        </Panel>
      </div>

      <Panel title="API keys" noPad>
        {keys.length === 0 ? (
          <div className="empty">
            <strong>No keys yet</strong>
            Create a key to call hosted APIs.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Prefix</th>
                  <th>Status</th>
                  <th>Last used</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id}>
                    <td>
                      <strong>{k.name}</strong>
                    </td>
                    <td className="mono">{k.prefix}…</td>
                    <td>
                      <StatusBadge value={k.status} />
                    </td>
                    <td>{formatTimestamp(k.lastUsedAt)}</td>
                    <td>{formatTimestamp(k.createdAt)}</td>
                    <td>
                      {k.status !== 'revoked' ? (
                        <button className="btn danger ghost" type="button" disabled={busy} onClick={() => void revokeKey(k.id)}>
                          Revoke
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </PageScaffold>
  )
}
