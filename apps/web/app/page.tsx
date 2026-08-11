'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MetaChip, PageScaffold, Panel, StatusBadge } from '@/components/app-shell'
import { apiClient } from '@/lib/api-client'
import { formatCredits, formatTimestamp, formatUsdFromCredits } from '@/lib/format'
import type { CloudWallet, Organization, Project } from '@/lib/api-types'

export default function OverviewPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [wallet, setWallet] = useState<CloudWallet | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([apiClient.listProjects(), apiClient.listOrganizations()])
      .then(async ([p, o]) => {
        setProjects(p)
        setOrganizations(o)
        if (p[0]?.id) {
          try {
            setWallet(await apiClient.getCloudWallet(p[0].id))
          } catch {
            setWallet(null)
          }
        }
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [])

  const ready = projects.filter((p) => p.status === 'ready').length

  return (
    <PageScaffold
      title="Overview"
      subtitle="Talocode Cloud control plane — projects, prepaid credits, and API access."
      breadcrumbs={[{ label: 'Overview' }]}
      metadata={
        <>
          <MetaChip label="Organizations" value={String(organizations.length)} />
          <MetaChip label="Projects" value={String(projects.length)} />
          {wallet ? <MetaChip label="Wallet" value={formatCredits(wallet.balance)} /> : null}
        </>
      }
      actions={
        <>
          <Link className="btn" href="/billing">
            Wallet
          </Link>
          <Link className="btn primary" href="/new-project">
            New project
          </Link>
        </>
      }
    >
      {error ? <div className="alert error">{error}</div> : null}

      <div className="grid-4">
        <div className="stat-card">
          <p className="label">Projects</p>
          <p className="value">{loading ? '—' : projects.length}</p>
          <p className="hint">{ready} ready</p>
        </div>
        <div className="stat-card">
          <p className="label">Organizations</p>
          <p className="value">{loading ? '—' : organizations.length}</p>
          <p className="hint">Active workspaces</p>
        </div>
        <div className="stat-card">
          <p className="label">Credit balance</p>
          <p className="value">{wallet ? formatCredits(wallet.balance) : '—'}</p>
          <p className="hint">{wallet ? formatUsdFromCredits(wallet.balance) : 'Select a project wallet'}</p>
        </div>
        <div className="stat-card">
          <p className="label">Lifetime spend</p>
          <p className="value">{wallet ? formatCredits(wallet.lifetimeSpend) : '—'}</p>
          <p className="hint">1 credit = $0.01</p>
        </div>
      </div>

      <div className="grid-2">
        <Panel
          title="Quick start"
          actions={
            <Link className="btn ghost" href="/billing/plans">
              Pricing
            </Link>
          }
        >
          <ol style={{ margin: 0, paddingLeft: 18, color: 'var(--text-secondary)', display: 'grid', gap: 10 }}>
            <li>
              Create a <Link href="/new-project"><strong>project</strong></Link> (100 free credits on new wallets).
            </li>
            <li>
              Create an <Link href="/usage/api-keys"><strong>API key</strong></Link> and store the secret once.
            </li>
            <li>
              Call <code className="mono">https://api.talocode.site</code> with{' '}
              <code className="mono">Authorization: Bearer …</code>
            </li>
            <li>
              Top up from <Link href="/billing"><strong>Wallet</strong></Link> when balance is low.
            </li>
          </ol>
        </Panel>

        <Panel title="Product namespaces">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>API</th>
                  <th>Path</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Tera', '/v1/tera/*'],
                  ['Skills', '/v1/skills/*'],
                  ['SearchLane', '/v1/searchlane/*'],
                  ['XSearchLane', '/v1/xsearchlane/*'],
                  ['Agent Browser', '/v1/agent-browser/*'],
                  ['ClipLoop', '/v1/cliploop/*'],
                ].map(([name, path]) => (
                  <tr key={name}>
                    <td>
                      <strong>{name}</strong>
                    </td>
                    <td className="mono">{path}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <Panel
        title="Recent projects"
        noPad
        actions={
          <Link className="btn ghost" href="/projects">
            View all
          </Link>
        }
      >
        {loading ? (
          <div className="empty">Loading projects…</div>
        ) : projects.length === 0 ? (
          <div className="empty">
            <strong>No projects yet</strong>
            Create a project to get API keys and a credit wallet.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Organization</th>
                  <th>Status</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {projects.slice(0, 8).map((project) => (
                  <tr key={project.id}>
                    <td>
                      <Link href={`/projects/${project.slug}`}>{project.name}</Link>
                    </td>
                    <td>{project.organization?.name || '—'}</td>
                    <td>
                      <StatusBadge value={project.status} />
                    </td>
                    <td>{formatTimestamp(project.updatedAt)}</td>
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
