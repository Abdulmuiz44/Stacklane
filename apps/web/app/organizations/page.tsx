'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { PageScaffold, Panel } from '@/components/app-shell'
import { apiClient } from '@/lib/api-client'
import { formatTimestamp } from '@/lib/format'
import type { Organization } from '@/lib/api-types'

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  async function load() {
    const list = await apiClient.listOrganizations()
    setOrgs(list)
  }

  useEffect(() => {
    load()
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await apiClient.createOrganization({
        name: name.trim(),
        slug: slug.trim() || undefined,
      })
      setName('')
      setSlug('')
      await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageScaffold
      title="Organizations"
      subtitle="Group projects under a workspace for billing and access."
      breadcrumbs={[{ label: 'Organizations' }]}
    >
      {error ? <div className="alert error">{error}</div> : null}

      <div className="grid-2">
        <Panel title="Create organization">
          <form onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (!slug) setSlug(slugify(e.target.value))
                }}
                placeholder="e.g. Acme Labs"
                required
                minLength={2}
              />
            </div>
            <div className="field">
              <label htmlFor="slug">Slug</label>
              <input id="slug" value={slug} onChange={(e) => setSlug(slugify(e.target.value))} placeholder="acme-labs" />
            </div>
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? 'Creating…' : 'Create organization'}
            </button>
          </form>
        </Panel>

        <Panel title="Why organizations?">
          <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-secondary)', display: 'grid', gap: 8 }}>
            <li>Own one or more Cloud projects</li>
            <li>Separate production and sandbox workspaces</li>
            <li>Keep API keys and wallets scoped per project</li>
          </ul>
          <p style={{ marginBottom: 0, marginTop: 16 }}>
            <Link className="btn" href="/new-project">
              Create project
            </Link>
          </p>
        </Panel>
      </div>

      <Panel title="Your organizations" noPad>
        {loading ? (
          <div className="empty">Loading…</div>
        ) : orgs.length === 0 ? (
          <div className="empty">
            <strong>No organizations</strong>
            Create one to attach projects.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <strong>{o.name}</strong>
                    </td>
                    <td className="mono">{o.slug}</td>
                    <td>{o.status}</td>
                    <td>{formatTimestamp(o.createdAt)}</td>
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

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
}
