'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MetaChip, PageScaffold, Panel } from '@/components/app-shell'
import { TcodeHoldPanel } from '@/components/tcode-hold-panel'
import { apiClient } from '@/lib/api-client'
import { formatCredits, formatTimestamp, formatUsdFromCredits } from '@/lib/format'
import type { CloudTransaction, CloudWallet, Project } from '@/lib/api-types'

const PRESETS = [500, 1000, 2500, 5000]

export default function BillingPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState('')
  const [wallet, setWallet] = useState<CloudWallet | null>(null)
  const [txns, setTxns] = useState<CloudTransaction[]>([])
  const [amount, setAmount] = useState('500')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

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
    setError(null)
    Promise.all([
      apiClient.getCloudWallet(projectId),
      apiClient.listCloudTransactions(projectId, 50),
    ])
      .then(([w, t]) => {
        setWallet(w)
        setTxns(t)
      })
      .catch((e) => setError((e as Error).message))
  }, [projectId])

  function reloadWallet() {
    if (!projectId) return
    Promise.all([
      apiClient.getCloudWallet(projectId),
      apiClient.listCloudTransactions(projectId, 50),
    ])
      .then(([w, t]) => {
        setWallet(w)
        setTxns(t)
      })
      .catch((e) => setError((e as Error).message))
  }

  async function topUp() {
    const credits = Number(amount)
    if (!projectId || !credits || credits < 500) {
      setError('Minimum top-up is 500 credits ($5.00).')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await apiClient.createCloudTopup(projectId, credits)
      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl)
        return
      }
      if (result.clientSecret && result.stripePublishableKey) {
        router.push(
          `/billing/top-up?clientSecret=${encodeURIComponent(result.clientSecret)}&publishableKey=${encodeURIComponent(result.stripePublishableKey)}`,
        )
        return
      }
      setError('Checkout is not available for this top-up. Please try again later.')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageScaffold
      title="Wallet"
      subtitle="Prepaid credits for Talocode Cloud APIs. 1 credit = $0.01 USD."
      breadcrumbs={[{ label: 'Wallet' }]}
      metadata={
        wallet ? (
          <>
            <MetaChip label="Balance" value={formatCredits(wallet.balance)} />
            <MetaChip label="USD" value={formatUsdFromCredits(wallet.balance)} />
          </>
        ) : null
      }
      actions={
        <Link className="btn" href="/billing/plans">
          View pricing
        </Link>
      }
    >
      {error ? <div className="alert error">{error}</div> : null}

      <div className="grid-3">
        <div className="stat-card">
          <p className="label">Balance</p>
          <p className="value">{wallet ? formatCredits(wallet.balance) : loading ? '…' : '—'}</p>
          <p className="hint">{wallet ? formatUsdFromCredits(wallet.balance) : '—'}</p>
        </div>
        <div className="stat-card">
          <p className="label">Lifetime credited</p>
          <p className="value">{wallet ? formatCredits(wallet.lifetimeCredits) : '—'}</p>
          <p className="hint">Grants + top-ups</p>
        </div>
        <div className="stat-card">
          <p className="label">Lifetime spend</p>
          <p className="value">{wallet ? formatCredits(wallet.lifetimeSpend) : '—'}</p>
          <p className="hint">API usage charges</p>
        </div>
      </div>

      <TcodeHoldPanel projectId={projectId} onClaimed={reloadWallet} />

      <div className="grid-2">
        <Panel title="Top up">
          <div className="field">
            <label htmlFor="project">Project wallet</label>
            <select id="project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              {projects.length === 0 ? <option value="">No projects</option> : null}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Presets</label>
            <div className="actions">
              {PRESETS.map((n) => (
                <button key={n} type="button" className="btn" onClick={() => setAmount(String(n))}>
                  {n} cr · {formatUsdFromCredits(n)}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="amount">Credits (min 500)</label>
            <input
              id="amount"
              type="number"
              min={500}
              step={100}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 0 }}>
            You will pay {formatUsdFromCredits(Number(amount) || 0)} for {Number(amount) || 0} credits.
          </p>
          <button className="btn primary" type="button" disabled={busy || !projectId} onClick={() => void topUp()}>
            {busy ? 'Starting checkout…' : 'Top up securely'}
          </button>
        </Panel>

        <Panel title="How billing works">
          <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-secondary)', display: 'grid', gap: 8 }}>
            <li>New wallets receive 100 free credits ($1).</li>
            <li>Minimum top-up is 500 credits ($5).</li>
            <li>Each API action deducts credits before the request runs.</li>
            <li>Insufficient balance returns HTTP 402.</li>
            <li>Open-source local CLIs do not spend cloud credits.</li>
            <li>$TCODE claims add usage credits to this same wallet once per UTC month.</li>
          </ul>
          <p style={{ marginBottom: 0, marginTop: 16 }}>
            <Link className="btn" href="/billing/usage">
              View usage
            </Link>
          </p>
        </Panel>
      </div>

      <Panel title="Transactions" noPad>
        {txns.length === 0 ? (
          <div className="empty">
            <strong>No transactions yet</strong>
            Top-ups and API charges will appear here.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Type</th>
                  <th>Product</th>
                  <th>Action</th>
                  <th>Delta</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {txns.map((t) => (
                  <tr key={t.id}>
                    <td>{formatTimestamp(t.createdAt)}</td>
                    <td>{t.type}</td>
                    <td>{t.product || '—'}</td>
                    <td className="mono">{t.action || '—'}</td>
                    <td style={{ color: t.creditsDelta >= 0 ? 'var(--ok)' : 'var(--bad)' }}>
                      {t.creditsDelta >= 0 ? '+' : ''}
                      {t.creditsDelta}
                    </td>
                    <td>{t.balanceAfter}</td>
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
