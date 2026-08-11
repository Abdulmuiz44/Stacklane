export function formatCredits(n: number) {
  return `${Number(n || 0).toLocaleString()} cr`
}

export function formatUsdFromCredits(credits: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    (Number(credits) || 0) * 0.01,
  )
}

export function formatTimestamp(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return value
  }
}

export function statusTone(status: string): 'ok' | 'warn' | 'bad' | 'muted' {
  const s = (status || '').toLowerCase()
  if (['ready', 'active', 'ok', 'healthy', 'succeeded', 'completed'].includes(s)) return 'ok'
  if (['provisioning', 'pending', 'running', 'queued', 'warning'].includes(s)) return 'warn'
  if (['error', 'failed', 'paused', 'revoked'].includes(s)) return 'bad'
  return 'muted'
}
