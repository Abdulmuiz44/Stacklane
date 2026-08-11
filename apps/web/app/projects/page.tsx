'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageScaffold, Panel, StatusBadge } from '@/components/app-shell'
import { apiClient } from '@/lib/api-client'
import { formatTimestamp } from '@/lib/format'
import type { Project } from '@/lib/api-types'

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiClient
      .listProjects()
      .then(setProjects)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <PageScaffold
      title="Projects"
      subtitle="Each project has API keys and a prepaid credit wallet."
      breadcrumbs={[{ label: 'Projects' }]}
      actions={
        <Link className="btn primary" href="/new-project">
          New project
        </Link>
      }
    >
      {error ? <div className="alert error">{error}</div> : null}
      <Panel title="All projects" noPad>
        {loading ? (
          <div className="empty">Loading…</div>
        ) : projects.length === 0 ? (
          <div className="empty">
            <strong>No projects</strong>
            Create your first project to start using Talocode Cloud APIs.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Organization</th>
                  <th>Region</th>
                  <th>Status</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/projects/${p.slug}`}>{p.name}</Link>
                    </td>
                    <td className="mono">{p.slug}</td>
                    <td>{p.organization?.name || '—'}</td>
                    <td>{p.region || '—'}</td>
                    <td>
                      <StatusBadge value={p.status} />
                    </td>
                    <td>{formatTimestamp(p.updatedAt)}</td>
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
