'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { PageScaffold, Panel } from '@/components/app-shell'

function TopUpContent() {
  const searchParams = useSearchParams()
  const clientSecret = searchParams.get('clientSecret')
  const publishableKey = searchParams.get('publishableKey')
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!clientSecret || !publishableKey) {
      setStatus('error')
      setError('Missing checkout parameters. Start a top-up from Wallet.')
      return
    }

    const script = document.createElement('script')
    script.src = 'https://js.stripe.com/v3/'
    script.async = true
    script.onload = () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const StripeFn = (window as any).Stripe as (key: string) => {
          initEmbeddedCheckout: (opts: { clientSecret: string }) => Promise<{ mount: (sel: string) => void }>
        }
        if (!StripeFn) throw new Error('Stripe.js failed to load')
        const stripe = StripeFn(publishableKey)
        stripe
          .initEmbeddedCheckout({ clientSecret })
          .then((checkout) => {
            checkout.mount('#stripe-checkout')
            setStatus('ready')
          })
          .catch((e: Error) => {
            setError(e.message)
            setStatus('error')
          })
      } catch (e) {
        setError((e as Error).message)
        setStatus('error')
      }
    }
    script.onerror = () => {
      setError('Could not load Stripe.js')
      setStatus('error')
    }
    document.head.appendChild(script)
  }, [clientSecret, publishableKey])

  return (
    <PageScaffold
      title="Top up"
      subtitle="Secure checkout via Stripe. Credits are added after payment confirmation."
      breadcrumbs={[{ label: 'Wallet', href: '/billing' }, { label: 'Top up' }]}
      actions={
        <Link className="btn" href="/billing">
          Back to wallet
        </Link>
      }
    >
      <Panel title="Checkout">
        {status === 'loading' ? <div className="empty">Loading secure checkout…</div> : null}
        {status === 'error' ? (
          <div>
            <div className="alert error">{error || 'Checkout unavailable'}</div>
            <Link className="btn primary" href="/billing" style={{ marginTop: 12, display: 'inline-flex' }}>
              Return to wallet
            </Link>
          </div>
        ) : null}
        <div id="stripe-checkout" style={{ minHeight: status === 'ready' ? 420 : 0 }} />
        {status === 'ready' ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, marginBottom: 0 }}>
            Powered by Stripe · card details never touch Talocode servers
          </p>
        ) : null}
      </Panel>
    </PageScaffold>
  )
}

export default function TopUpPage() {
  return (
    <Suspense
      fallback={
        <PageScaffold title="Top up" subtitle="Loading…">
          <div className="empty">Loading…</div>
        </PageScaffold>
      }
    >
      <TopUpContent />
    </Suspense>
  )
}
