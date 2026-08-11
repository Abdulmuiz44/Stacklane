'use client'

import { useEffect, useMemo, useState } from 'react'
import { MetaChip, PageScaffold, Panel } from '@/components/app-shell'
import { apiClient } from '@/lib/api-client'
import { formatCredits, formatTimestamp } from '@/lib/format'
import type { CloudUsageEvent, Project } from '@/lib/api-types'

export default function UsagePage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState('')
  const [events, setEvents] = useState<CloudUsageEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiClient
      .listProjects()
      .then((list) => {
        setProjects(list)
        if (list[0]) setProjectId(list[0].id)
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!projectId) return
    apiClient
      .listCloudUsageEvents(projectId, 100)
      .then(setEvents)
      .catch((e) => setError((e as Error).message))
  }, [projectId])

  const totals = useMemo(() => {
    const byProduct: Record<string, number> = {}
    let sum = 0
    for (const e of events) {
      sum += e.credits || 0
      byProduct[e.product] = (byProduct[e.product] || 0) + (e.credits || 0)
    }
    return { sum, byProduct }
  }, [events])

  return (
    <PageScaffold
      title="Usage"
      subtitle="Metered API calls and credit spend for the selected project."
      breadcrumbs={[{ label: 'Wallet', href: '/billing' }, { label: 'Usage' }]}
      metadata={
        <>
          <MetaChip label="Events" value={String(events.length)} />
          <MetaChip label="Credits (page)" value={formatCredits(totals.sum)} />
        </>
      }
    >
      {error ? <div className="alert error">{error}</div> : null}

      <Panel title="Filter">
        <div className="field" style={{ marginBottom: 0, maxWidth: 360 }}>
          <label htmlFor="project">Project</label>
          <select id="project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </Panel>

      <div className="grid-3">
        {Object.keys(totals.byProduct).length === 0 ? (
          <div className="stat-card">
            <p className="label">By product</p>
            <p className="value" style={{ fontSize: 16 }}>
              No usage yet
            </p>
          </div>
        ) : (
          Object.entries(totals.byProduct)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([product, credits]) => (
              <div className="stat-card" key={product}>
                <p className="label">{product}</p>
                <p className="value" style={{ fontSize: 20 }}>
                  {formatCredits(credits)}
                </p>
              </div>
            ))
        )}
      </div>

      <Panel title="Recent events" noPad>
        {loading ? (
          <div className="empty">Loading…</div>
        ) : events.length === 0 ? (
          <div className="empty">
            <strong>No usage events</strong>
            Call a hosted API with your project key to see metering here.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Product</th>
                  <th>Action</th>
                  <th>Credits</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td>{formatTimestamp(e.createdAt)}</td>
                    <td>{e.product}</td>
                    <td className="mono">{e.action}</td>
                    <td>{e.credits}</td>
                    <td>{e.status}</td>
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
