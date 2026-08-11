'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PageScaffold, Panel } from '@/components/app-shell'
import { apiClient } from '@/lib/api-client'
import type { Organization } from '@/lib/api-types'

export default function NewProjectPage() {
  const router = useRouter()
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [organizationId, setOrganizationId] = useState('')
  const [region, setRegion] = useState('global')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    apiClient
      .listOrganizations()
      .then((list) => {
        setOrgs(list)
        if (list[0]) setOrganizationId(list[0].id)
      })
      .catch((e) => setError((e as Error).message))
  }, [])

  function onNameChange(value: string) {
    setName(value)
    if (!slug || slug === slugify(name)) {
      setSlug(slugify(value))
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!organizationId) {
      setError('Create an organization first.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const project = await apiClient.createProject({
        name: name.trim(),
        organizationId,
        status: 'ready',
        region,
        description: description.trim() || 'Talocode Cloud project',
        slug: slug.trim() || undefined,
      })
      router.push(`/projects/${project.slug}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageScaffold
      title="New project"
      subtitle="Projects group API keys and a credit wallet for Talocode Cloud."
      breadcrumbs={[{ label: 'Projects', href: '/projects' }, { label: 'New' }]}
    >
      <Panel title="Project details">
        {orgs.length === 0 ? (
          <div className="alert">
            You need an organization first.{' '}
            <Link href="/organizations">
              <strong>Create organization</strong>
            </Link>
          </div>
        ) : null}
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g. production"
              required
              minLength={2}
            />
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="slug">Slug</label>
              <input id="slug" value={slug} onChange={(e) => setSlug(slugify(e.target.value))} placeholder="production" />
            </div>
            <div className="field">
              <label htmlFor="org">Organization</label>
              <select id="org" value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} required>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="region">Region label</label>
            <input id="region" value={region} onChange={(e) => setRegion(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="desc">Description</label>
            <textarea id="desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {error ? <p className="alert error">{error}</p> : null}
          <div className="actions">
            <Link className="btn" href="/projects">
              Cancel
            </Link>
            <button className="btn primary" type="submit" disabled={loading || orgs.length === 0}>
              {loading ? 'Creating…' : 'Create project'}
            </button>
          </div>
        </form>
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
