'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut, Menu, X } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { navSections } from './nav-config'
import { apiClient } from '@/lib/api-client'
import type { User } from '@/lib/api-types'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { statusTone } from '@/lib/format'

export function StatusBadge({ value }: { value: string }) {
  const tone = statusTone(value)
  return <span className={`badge ${tone}`}>{value || 'unknown'}</span>
}

export function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="chip">
      {label}: <strong>{value}</strong>
    </span>
  )
}

export function Panel({
  title,
  actions,
  children,
  noPad,
}: {
  title: string
  actions?: ReactNode
  children: ReactNode
  noPad?: boolean
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
        {actions ? <div className="actions">{actions}</div> : null}
      </div>
      <div className={noPad ? undefined : 'panel-body'}>{children}</div>
    </section>
  )
}

export function PageScaffold({
  title,
  subtitle,
  breadcrumbs,
  metadata,
  actions,
  children,
}: {
  title: string
  subtitle?: string
  breadcrumbs?: Array<{ label: string; href?: string }>
  metadata?: ReactNode
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div>
      <div className="page-head">
        <div>
          {breadcrumbs?.length ? (
            <div className="breadcrumbs">
              {breadcrumbs.map((crumb, i) => (
                <span key={`${crumb.label}-${i}`}>
                  {i > 0 ? ' / ' : null}
                  {crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : crumb.label}
                </span>
              ))}
            </div>
          ) : null}
          <h1>{title}</h1>
          {subtitle ? <p className="subtitle">{subtitle}</p> : null}
          {metadata ? <div className="meta-row">{metadata}</div> : null}
        </div>
        {actions ? <div className="actions">{actions}</div> : null}
      </div>
      <div className="stack">{children}</div>
    </div>
  )
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const path = usePathname()

  return (
    <>
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <span className="brand-mark">T</span>
          <div>
            <div>Talocode</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Cloud</div>
          </div>
        </div>
        <div className="sidebar-body">
          {navSections.map((section) => (
            <div key={section.title} className="nav-section">
              <div className="nav-section-title">{section.title}</div>
              {section.items.map((item) => {
                const Icon = item.icon
                const active =
                  item.href === '/'
                    ? path === '/'
                    : path === item.href || path.startsWith(`${item.href}/`)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-item ${active ? 'active' : ''}`}
                    onClick={onClose}
                  >
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          ))}
        </div>
        <div className="sidebar-foot">
          1 credit = $0.01 · prepaid wallet
        </div>
      </aside>
      {open ? <button className="overlay" onClick={onClose} aria-label="Close menu" type="button" /> : null}
    </>
  )
}

function TopBar({
  onToggle,
  user,
  onLogout,
}: {
  onToggle: () => void
  user: User | null
  onLogout: () => Promise<void>
}) {
  return (
    <header className="topbar">
      <div className="left">
        <button className="icon-btn menu-btn" onClick={onToggle} aria-label="Toggle navigation" type="button">
          <Menu size={18} />
        </button>
        <span style={{ fontWeight: 600, letterSpacing: '-0.02em' }}>Dashboard</span>
      </div>
      <div className="right">
        <ThemeToggle />
        {user ? (
          <span className="chip" title={user.email}>
            {user.name || user.email}
          </span>
        ) : null}
        <button className="icon-btn" onClick={() => void onLogout()} aria-label="Sign out" type="button" title="Sign out">
          <LogOut size={16} />
        </button>
      </div>
    </header>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const router = useRouter()
  const path = usePathname()

  useEffect(() => {
    setOpen(false)
  }, [path])

  useEffect(() => {
    apiClient
      .me()
      .then(setUser)
      .catch(() => setUser(null))
  }, [])

  async function onLogout() {
    try {
      await apiClient.logout()
    } catch {
      /* ignore */
    }
    router.push('/signin')
  }

  return (
    <div className="app-frame">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <TopBar onToggle={() => setOpen((v) => !v)} user={user} onLogout={onLogout} />
      <main className="main">{children}</main>
    </div>
  )
}
