import './globals.css'
import type { Metadata } from 'next'
import { type ReactNode } from 'react'
import { RootFrame } from '@/components/root-frame'
import { ThemeProvider } from '@/components/theme/theme-provider'

export const metadata: Metadata = {
  title: {
    default: 'Talocode Cloud',
    template: '%s · Talocode Cloud',
  },
  description: 'Talocode Cloud dashboard — projects, API keys, wallet credits, and usage.',
  applicationName: 'Talocode Cloud',
  metadataBase: new URL('https://stacklane.talocode.site'),
  icons: {
    icon: '/assets/talocode-logo.jpg',
  },
  openGraph: {
    type: 'website',
    url: 'https://stacklane.talocode.site',
    title: 'Stacklane | Talocode Cloud Control Plane',
    description: 'Projects, API keys, wallet credits, usage, and billing for Talocode Cloud.',
    siteName: 'Talocode',
    images: [{ url: '/assets/talocode-logo.jpg', width: 400, height: 400, alt: 'Talocode logo' }],
  },
  twitter: {
    card: 'summary',
    title: 'Stacklane | Talocode Cloud Control Plane',
    description: 'Projects, API keys, wallet credits, usage, and billing for Talocode Cloud.',
    images: ['/assets/talocode-logo.jpg'],
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <RootFrame>{children}</RootFrame>
        </ThemeProvider>
      </body>
    </html>
  )
}
