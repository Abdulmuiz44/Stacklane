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
