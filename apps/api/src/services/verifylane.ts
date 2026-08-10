/**
 * VerifyLane — deterministic checks for agent/AI-generated code & artifacts.
 * No LLM required. Pattern rules + structure analysis.
 */

export const VERIFYLANE_VERSION = '0.1.0'

export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical'

export interface Finding {
  id: string
  rule: string
  severity: Severity
  message: string
  line?: number
  column?: number
  path?: string
  snippet?: string
}

export interface VerifyResult {
  ok: boolean
  product: 'verifylane'
  version: string
  mode: string
  findings: Finding[]
  summary: { critical: number; high: number; medium: number; low: number; info: number; total: number }
  durationMs: number
}

function summarize(findings: Finding[]): VerifyResult['summary'] {
  const summary = { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: findings.length }
  for (const f of findings) summary[f.severity]++
  return summary
}

function linesOf(text: string): string[] {
  return text.replace(/\r\n/g, '\n').split('\n')
}

const SECRET_PATTERNS: Array<{ id: string; re: RegExp; message: string; severity: Severity }> = [
  { id: 'secret.aws_key', re: /AKIA[0-9A-Z]{16}/g, message: 'Possible AWS access key id', severity: 'critical' },
  { id: 'secret.generic_api_key', re: /(?:api[_-]?key|apikey|secret[_-]?key)\s*[:=]\s*['"][A-Za-z0-9_\-]{16,}['"]/gi, message: 'Hardcoded API key-like assignment', severity: 'high' },
  { id: 'secret.bearer', re: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, message: 'Bearer token literal', severity: 'high' },
  { id: 'secret.private_key', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, message: 'Private key material', severity: 'critical' },
  { id: 'secret.password_assign', re: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{4,}['"]/gi, message: 'Hardcoded password assignment', severity: 'high' },
  { id: 'secret.jwt', re: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, message: 'JWT-like token literal', severity: 'medium' },
  { id: 'secret.slack', re: /xox[baprs]-[0-9A-Za-z-]{10,}/g, message: 'Slack token pattern', severity: 'critical' },
  { id: 'secret.github_pat', re: /ghp_[A-Za-z0-9]{36}/g, message: 'GitHub personal access token', severity: 'critical' },
  { id: 'secret.openai', re: /sk-[A-Za-z0-9]{20,}/g, message: 'OpenAI-style secret key', severity: 'high' },
]

const SECURITY_PATTERNS: Array<{ id: string; re: RegExp; message: string; severity: Severity }> = [
  { id: 'sec.eval', re: /\beval\s*\(/g, message: 'Use of eval()', severity: 'high' },
  { id: 'sec.function_ctor', re: /new\s+Function\s*\(/g, message: 'Dynamic Function constructor', severity: 'high' },
  { id: 'sec.child_process', re: /child_process\.(exec|execSync|spawn)\s*\(/g, message: 'Shell execution via child_process', severity: 'medium' },
  { id: 'sec.dangerously_set', re: /dangerouslySetInnerHTML/g, message: 'dangerouslySetInnerHTML (XSS risk)', severity: 'medium' },
  { id: 'sec.inner_html', re: /\.innerHTML\s*=/g, message: 'innerHTML assignment', severity: 'medium' },
  { id: 'sec.sql_concat', re: /(?:SELECT|INSERT|UPDATE|DELETE)[\s\S]{0,80}\+\s*['"`]/gi, message: 'Possible SQL string concatenation', severity: 'high' },
  { id: 'sec.http_cleartext', re: /http:\/\/(?!localhost|127\.0\.0\.1)/gi, message: 'Cleartext http URL', severity: 'low' },
  { id: 'sec.disable_tls', re: /rejectUnauthorized\s*:\s*false/g, message: 'TLS verification disabled', severity: 'high' },
  { id: 'sec.md5', re: /\bcreateHash\s*\(\s*['"]md5['"]\s*\)/g, message: 'MD5 used for hashing', severity: 'low' },
]

const QUALITY_PATTERNS: Array<{ id: string; re: RegExp; message: string; severity: Severity }> = [
  { id: 'quality.any_ts', re: /:\s*any\b/g, message: 'TypeScript any type', severity: 'low' },
  { id: 'quality.todo', re: /\bTODO\b|\bFIXME\b|\bHACK\b/g, message: 'TODO/FIXME/HACK marker', severity: 'info' },
  { id: 'quality.console_log', re: /console\.(log|debug|info)\s*\(/g, message: 'console.log left in code', severity: 'info' },
  { id: 'quality.eslint_disable', re: /eslint-disable/g, message: 'eslint-disable directive', severity: 'low' },
  { id: 'quality.ts_ignore', re: /@ts-ignore|@ts-nocheck/g, message: 'TypeScript check suppression', severity: 'medium' },
  { id: 'quality.empty_catch', re: /catch\s*\([^)]*\)\s*\{\s*\}/g, message: 'Empty catch block', severity: 'medium' },
]

function scanPatterns(
  text: string,
  path: string | undefined,
  patterns: Array<{ id: string; re: RegExp; message: string; severity: Severity }>,
  rulePrefix: string,
): Finding[] {
  const findings: Finding[] = []
  const lines = linesOf(text)
  for (const p of patterns) {
    // reset lastIndex for global regexes
    p.re.lastIndex = 0
    let m: RegExpExecArray | null
    const re = new RegExp(p.re.source, p.re.flags.includes('g') ? p.re.flags : p.re.flags + 'g')
    while ((m = re.exec(text)) !== null) {
      const before = text.slice(0, m.index)
      const line = before.split('\n').length
      const col = before.length - before.lastIndexOf('\n')
      findings.push({
        id: `${p.id}:${line}:${col}`,
        rule: p.id,
        severity: p.severity,
        message: p.message,
        line,
        column: col,
        path,
        snippet: (lines[line - 1] || '').trim().slice(0, 200),
      })
      if (findings.length > 500) return findings
    }
  }
  void rulePrefix
  return findings
}

export function verifySecrets(input: { text?: string; path?: string; files?: Array<{ path?: string; content: string }> }): VerifyResult {
  const started = Date.now()
  const findings: Finding[] = []
  const files = input.files?.length
    ? input.files
    : input.text != null
      ? [{ path: input.path, content: input.text }]
      : []
  if (!files.length) throw new Error('text or files required')
  for (const f of files) {
    findings.push(...scanPatterns(f.content, f.path, SECRET_PATTERNS, 'secret'))
  }
  const summary = summarize(findings)
  return {
    ok: summary.critical === 0 && summary.high === 0,
    product: 'verifylane',
    version: VERIFYLANE_VERSION,
    mode: 'secrets',
    findings,
    summary,
    durationMs: Date.now() - started,
  }
}

export function verifySecurity(input: { text?: string; path?: string; files?: Array<{ path?: string; content: string }> }): VerifyResult {
  const started = Date.now()
  const findings: Finding[] = []
  const files = input.files?.length
    ? input.files
    : input.text != null
      ? [{ path: input.path, content: input.text }]
      : []
  if (!files.length) throw new Error('text or files required')
  for (const f of files) {
    findings.push(...scanPatterns(f.content, f.path, SECURITY_PATTERNS, 'sec'))
  }
  const summary = summarize(findings)
  return {
    ok: summary.critical === 0 && summary.high === 0,
    product: 'verifylane',
    version: VERIFYLANE_VERSION,
    mode: 'security',
    findings,
    summary,
    durationMs: Date.now() - started,
  }
}

export function verifyQuality(input: { text?: string; path?: string; files?: Array<{ path?: string; content: string }> }): VerifyResult {
  const started = Date.now()
  const findings: Finding[] = []
  const files = input.files?.length
    ? input.files
    : input.text != null
      ? [{ path: input.path, content: input.text }]
      : []
  if (!files.length) throw new Error('text or files required')
  for (const f of files) {
    findings.push(...scanPatterns(f.content, f.path, QUALITY_PATTERNS, 'quality'))
  }
  const summary = summarize(findings)
  return {
    ok: true,
    product: 'verifylane',
    version: VERIFYLANE_VERSION,
    mode: 'quality',
    findings,
    summary,
    durationMs: Date.now() - started,
  }
}

/** Unified pass: secrets + security + quality (+ optional unified diff parse). */
export function verifyCode(input: {
  text?: string
  path?: string
  files?: Array<{ path?: string; content: string }>
  modes?: Array<'secrets' | 'security' | 'quality'>
}): VerifyResult {
  const started = Date.now()
  const modes = input.modes?.length ? input.modes : (['secrets', 'security', 'quality'] as const)
  const findings: Finding[] = []
  if (modes.includes('secrets')) findings.push(...verifySecrets(input).findings)
  if (modes.includes('security')) findings.push(...verifySecurity(input).findings)
  if (modes.includes('quality')) findings.push(...verifyQuality(input).findings)
  // dedupe by id
  const seen = new Set<string>()
  const unique = findings.filter((f) => (seen.has(f.id) ? false : (seen.add(f.id), true)))
  const summary = summarize(unique)
  return {
    ok: summary.critical === 0 && summary.high === 0,
    product: 'verifylane',
    version: VERIFYLANE_VERSION,
    mode: modes.join('+'),
    findings: unique,
    summary,
    durationMs: Date.now() - started,
  }
}

/** Parse unified diff and verify added lines only. */
export function verifyDiff(input: { diff: string; modes?: Array<'secrets' | 'security' | 'quality'> }): VerifyResult {
  const started = Date.now()
  if (!input.diff?.trim()) throw new Error('diff is required')
  const added: Array<{ path?: string; content: string }> = []
  let currentPath: string | undefined
  const buf: string[] = []
  const flush = () => {
    if (buf.length) {
      added.push({ path: currentPath, content: buf.join('\n') })
      buf.length = 0
    }
  }
  for (const line of linesOf(input.diff)) {
    if (line.startsWith('+++ ')) {
      flush()
      currentPath = line.slice(4).replace(/^b\//, '').trim()
      continue
    }
    if (line.startsWith('+') && !line.startsWith('+++')) {
      buf.push(line.slice(1))
    }
  }
  flush()
  if (!added.length) {
    return {
      ok: true,
      product: 'verifylane',
      version: VERIFYLANE_VERSION,
      mode: 'diff',
      findings: [],
      summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 },
      durationMs: Date.now() - started,
    }
  }
  const result = verifyCode({ files: added, modes: input.modes })
  return { ...result, mode: `diff:${result.mode}`, durationMs: Date.now() - started }
}

/** Lightweight agent output checks: empty, huge, obvious refusal, tool-call loops. */
export function verifyAgentOutput(input: {
  text?: string
  messages?: Array<{ role?: string; content?: string }>
  maxChars?: number
}): VerifyResult {
  const started = Date.now()
  const findings: Finding[] = []
  const text =
    input.text ??
    (input.messages || [])
      .map((m) => m.content || '')
      .join('\n')
  const maxChars = input.maxChars ?? 200_000
  if (!text.trim()) {
    findings.push({
      id: 'agent.empty',
      rule: 'agent.empty',
      severity: 'high',
      message: 'Agent output is empty',
    })
  }
  if (text.length > maxChars) {
    findings.push({
      id: 'agent.too_large',
      rule: 'agent.too_large',
      severity: 'medium',
      message: `Agent output exceeds maxChars (${text.length} > ${maxChars})`,
    })
  }
  if (/\b(as an ai|i cannot|i can't assist|i'm unable to)\b/i.test(text) && text.length < 400) {
    findings.push({
      id: 'agent.refusal',
      rule: 'agent.refusal',
      severity: 'medium',
      message: 'Output looks like a model refusal / non-answer',
    })
  }
  const loopish = text.match(/(\b\w{4,}\b)(?:\s+\1){4,}/g)
  if (loopish?.length) {
    findings.push({
      id: 'agent.repeat_loop',
      rule: 'agent.repeat_loop',
      severity: 'medium',
      message: 'Repetitive loop-like text detected',
      snippet: loopish[0].slice(0, 120),
    })
  }
  // secrets in agent output
  findings.push(...scanPatterns(text, undefined, SECRET_PATTERNS, 'secret'))
  const summary = summarize(findings)
  return {
    ok: summary.critical === 0 && summary.high === 0,
    product: 'verifylane',
    version: VERIFYLANE_VERSION,
    mode: 'agent-output',
    findings,
    summary,
    durationMs: Date.now() - started,
  }
}

export function getVerifyLanePricing() {
  return {
    product: 'verifylane',
    version: VERIFYLANE_VERSION,
    credits: {
      'verifylane.secrets': 3,
      'verifylane.security': 5,
      'verifylane.quality': 3,
      'verifylane.code': 8,
      'verifylane.diff': 8,
      'verifylane.agent-output': 5,
    },
    note: 'Deterministic verification — no LLM. Secrets/security/quality heuristics for agent code and diffs.',
  }
}

export function getVerifyLaneCapabilities() {
  return {
    product: 'verifylane',
    version: VERIFYLANE_VERSION,
    endpoints: [
      'GET /v1/verifylane/health',
      'GET /v1/verifylane/pricing',
      'GET /v1/verifylane/capabilities',
      'POST /v1/verifylane/secrets',
      'POST /v1/verifylane/security',
      'POST /v1/verifylane/quality',
      'POST /v1/verifylane/code',
      'POST /v1/verifylane/diff',
      'POST /v1/verifylane/agent-output',
    ],
    outputs: ['findings[]', 'severity summary', 'ok pass/fail'],
    limitations: [
      'Heuristic patterns only — not a full SAST suite',
      'No language-server semantic analysis in v0.1',
      'Diff mode only scans added lines',
    ],
  }
}
