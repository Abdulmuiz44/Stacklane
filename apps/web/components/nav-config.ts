import type React from 'react'
import {
  Activity,
  BarChart3,
  Building2,
  CreditCard,
  FolderKanban,
  KeyRound,
  Settings,
  Wallet,
} from 'lucide-react'

export type NavLeaf = { label: string; href: string; icon: React.ComponentType<{ size?: number }> }
export type NavSection = { title: string; items: NavLeaf[] }

/** Talocode Cloud only — no infra placeholders, no legacy billing. */
export const navSections: NavSection[] = [
  {
    title: 'Cloud',
    items: [
      { label: 'Overview', href: '/', icon: Activity },
      { label: 'Projects', href: '/projects', icon: FolderKanban },
      { label: 'Organizations', href: '/organizations', icon: Building2 },
    ],
  },
  {
    title: 'Billing',
    items: [
      { label: 'Wallet', href: '/billing', icon: Wallet },
      { label: 'Usage', href: '/billing/usage', icon: BarChart3 },
      { label: 'Pricing', href: '/billing/plans', icon: CreditCard },
    ],
  },
  {
    title: 'Access',
    items: [
      { label: 'API keys', href: '/usage/api-keys', icon: KeyRound },
      { label: 'Settings', href: '/settings', icon: Settings },
    ],
  },
]
