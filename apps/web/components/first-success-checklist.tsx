'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Panel } from '@/components/app-shell'
import { apiClient } from '@/lib/api-client'
import type { ApiKey, CloudUsageEvent, Project } from '@/lib/api-types'

type ChecklistState = {
  keys: ApiKey[]
  usageEvents: CloudUsageEvent[]
  loading: boolean
}

export function FirstSuccessChecklist({ project }: { project: Project | null }) {
  const [state, setState] = useState<ChecklistState>({ keys: [], usageEvents: [], loading: Boolean(project) })

  useEffect(() => {
    if (!project) {
      setState({ keys: [], usageEvents: [], loading: false })
      return
    }

    let active = true
    setState((current) => ({ ...current, loading: true }))

    Promise.all([
      apiClient.listProjectApiKeys(project.slug).catch(() => []),
      apiClient.listCloudUsageEvents(project.id).catch(() => []),
    ])
      .then(([keys, usageEvents]) => {
        if (active) setState({ keys, usageEvents, loading: false })
      })

    return () => {
      active = false
    }
  }, [project])

  if (!project || state.loading) return null

  const hasKey = state.keys.length > 0
  const hasUsedKey = state.keys.some((key) => key.lastUsedAt)
  const hasSuccessfulCall = state.usageEvents.some((event) => event.status === 'success')
  const steps = [
    {
      complete: true,
      label: 'Create a project',
      detail: `${project.name} is ready to configure.`,
      action: <Link href={`/projects/${project.slug}`}>View project</Link>,
    },
    {
      complete: hasKey,
      label: 'Generate an API key',
      detail: hasKey ? 'A project key is available.' : 'Create a key and copy it while it is shown.',
      action: <Link href="/usage/api-keys">{hasKey ? 'Manage keys' : 'Create key'}</Link>,
    },
    {
      complete: hasUsedKey || hasSuccessfulCall,
      label: 'Connect your agent',
      detail: hasUsedKey
        ? 'Your key has reached Talocode.'
        : 'Add TALOCODE_API_KEY and TALOCODE_BASE_URL to your agent configuration.',
      action: <Link href="/usage/api-keys">View config</Link>,
    },
    {
      complete: hasSuccessfulCall,
      label: 'Make your first call',
      detail: hasSuccessfulCall
        ? 'First API activity recorded. You are ready to build.'
        : 'Send a request to api.talocode.site to confirm the connection.',
      action: <Link href="/usage/api-keys">Copy test request</Link>,
    },
  ]

  const completed = steps.filter((step) => step.complete).length
  if (completed === steps.length) return null

  return (
    <Panel title="First successful call">
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'baseline' }}>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
            Complete the next step to activate your project.
          </p>
          <strong aria-label={`${completed} of ${steps.length} steps completed`}>
            {completed}/{steps.length}
          </strong>
        </div>

        <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
          {steps.map((step, index) => (
            <li
              key={step.label}
              style={{
                display: 'grid',
                gridTemplateColumns: '28px minmax(0, 1fr) auto',
                alignItems: 'center',
                gap: 12,
                padding: '12px 0',
                borderTop: index ? '1px solid var(--border)' : undefined,
              }}
            >
              <span
                aria-label={step.complete ? 'Complete' : 'Not complete'}
                style={{
                  display: 'grid',
                  placeItems: 'center',
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  color: step.complete ? 'var(--surface)' : 'var(--text-muted)',
                  background: step.complete ? 'var(--accent)' : 'transparent',
                  border: step.complete ? undefined : '1px solid var(--border)',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {step.complete ? '✓' : index + 1}
              </span>
              <div>
                <strong>{step.label}</strong>
                <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 2 }}>{step.detail}</div>
              </div>
              <div style={{ whiteSpace: 'nowrap' }}>{step.action}</div>
            </li>
          ))}
        </ol>
      </div>
    </Panel>
  )
}
