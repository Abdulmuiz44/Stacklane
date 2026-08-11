'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { PageScaffold, Panel } from '@/components/app-shell'
import { apiClient } from '@/lib/api-client'
import { formatUsdFromCredits } from '@/lib/format'
import type { CloudPricingTier } from '@/lib/api-types'

export default function PricingPage() {
  const [tiers, setTiers] = useState<CloudPricingTier[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    apiClient
      .listCloudPricing()
      .then(setTiers)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return tiers
    return tiers.filter(
      (t) =>
        t.product.toLowerCase().includes(q) ||
        t.action.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q),
    )
  }, [tiers, filter])

  const products = useMemo(() => [...new Set(tiers.map((t) => t.product))].sort(), [tiers])

  return (
    <PageScaffold
      title="Pricing"
      subtitle="Pay-per-use catalog. 1 credit = $0.01 USD. New wallets start with 100 free credits."
      breadcrumbs={[{ label: 'Wallet', href: '/billing' }, { label: 'Pricing' }]}
      actions={
        <Link className="btn primary" href="/billing">
          Top up wallet
        </Link>
      }
    >
      {error ? <div className="alert error">{error}</div> : null}

      <div className="grid-4">
        <div className="stat-card">
          <p className="label">Credit value</p>
          <p className="value">$0.01</p>
        </div>
        <div className="stat-card">
          <p className="label">Free grant</p>
          <p className="value">100</p>
          <p className="hint">per new project wallet</p>
        </div>
        <div className="stat-card">
          <p className="label">Min top-up</p>
          <p className="value">500</p>
          <p className="hint">$5.00</p>
        </div>
        <div className="stat-card">
          <p className="label">Products</p>
          <p className="value">{products.length || '—'}</p>
        </div>
      </div>

      <Panel title="Catalog">
        <div className="field" style={{ maxWidth: 360 }}>
          <label htmlFor="filter">Filter</label>
          <input
            id="filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search product or action"
          />
        </div>
        {loading ? (
          <div className="empty">Loading pricing…</div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <strong>No pricing rows</strong>
            {error
              ? 'Could not load catalog from API.'
              : 'API returned an empty catalog. Check GET /api/v1/cloud/pricing.'}
          </div>
        ) : (
          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Action</th>
                  <th>Credits</th>
                  <th>USD</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={`${t.product}:${t.action}`}>
                    <td>
                      <strong>{t.product}</strong>
                    </td>
                    <td className="mono">{t.action}</td>
                    <td>{t.credits}</td>
                    <td>{formatUsdFromCredits(t.credits)}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{t.description || '—'}</td>
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
