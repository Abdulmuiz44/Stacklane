import type { IncomingMessage, ServerResponse } from 'node:http'

export class HttpError extends Error {
  statusCode: number
  code: string
  details?: Record<string, unknown>

  constructor(statusCode: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }
}

type CorsRes = ServerResponse & { __corsOrigin?: string }

const DEFAULT_ALLOWED_ORIGINS = [
  'https://dashboard.talocode.site',
  'https://stacklane.talocode.site',
  'https://talocode.site',
  'https://cloud.talocode.site',
  'https://docs.talocode.site',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
]

function allowedOrigins(): string[] {
  const fromEnv = (process.env.WEB_ORIGINS || process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const single = process.env.WEB_ORIGIN?.trim()
  const list = [...DEFAULT_ALLOWED_ORIGINS, ...fromEnv]
  if (single) list.push(single)
  return [...new Set(list)]
}

export function resolveCorsOrigin(req: IncomingMessage | undefined): string {
  const requestOrigin = typeof req?.headers?.origin === 'string' ? req.headers.origin : ''
  const allowed = allowedOrigins()
  if (requestOrigin && allowed.includes(requestOrigin)) return requestOrigin
  // Prefer WEB_ORIGIN, then dashboard (primary cloud UI), then first default
  return process.env.WEB_ORIGIN || 'https://dashboard.talocode.site'
}

/** Call once at the start of each request so sendJson reflects the browser Origin. */
export function attachCors(res: ServerResponse, req: IncomingMessage) {
  ;(res as CorsRes).__corsOrigin = resolveCorsOrigin(req)
}

function corsHeaderBag(res: ServerResponse): Record<string, string> {
  const origin = (res as CorsRes).__corsOrigin || process.env.WEB_ORIGIN || 'https://dashboard.talocode.site'
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'access-control-allow-headers': 'Content-Type, Authorization, X-Api-Key, Cookie, X-Request-Id',
    'access-control-allow-credentials': 'true',
    'access-control-max-age': '86400',
    vary: 'Origin',
  }
}

export function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    ...corsHeaderBag(res),
  })
  res.end(JSON.stringify(payload))
}

export function sendData(res: ServerResponse, statusCode: number, data: unknown) {
  sendJson(res, statusCode, { data })
}

export function sendError(res: ServerResponse, error: HttpError) {
  sendJson(res, error.statusCode, {
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
    },
  })
}

export async function parseBody(req: IncomingMessage, maxBytes?: number) {
  // Netlify / Fetch Request adapters may expose a pre-read body
  const anyReq = req as IncomingMessage & {
    body?: string | Record<string, unknown>
    json?: () => Promise<unknown>
  }
  if (anyReq.body && typeof anyReq.body === 'object' && !Buffer.isBuffer(anyReq.body)) {
    return anyReq.body as Record<string, unknown>
  }
  if (typeof anyReq.body === 'string' && anyReq.body) {
    try {
      return JSON.parse(anyReq.body) as Record<string, unknown>
    } catch {
      throw new HttpError(400, 'INVALID_JSON', 'Request body must be valid JSON.')
    }
  }

  return new Promise<Record<string, unknown>>((resolve, reject) => {
    if (typeof (req as NodeJS.ReadableStream).on !== 'function') {
      resolve({})
      return
    }

    const declaredLength = Number(req.headers['content-length'])
    if (maxBytes && Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      reject(new HttpError(413, 'PAYLOAD_TOO_LARGE', `Request body must be ${maxBytes} bytes or less.`))
      return
    }

    let raw = ''
    let receivedBytes = 0
    let rejected = false
    req.on('data', (chunk) => {
      receivedBytes += Buffer.byteLength(chunk)
      if (maxBytes && receivedBytes > maxBytes) {
        rejected = true
        req.resume()
        reject(new HttpError(413, 'PAYLOAD_TOO_LARGE', `Request body must be ${maxBytes} bytes or less.`))
        return
      }
      raw += chunk
    })
    req.on('end', () => {
      if (rejected) return
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw) as Record<string, unknown>)
      } catch {
        reject(new HttpError(400, 'INVALID_JSON', 'Request body must be valid JSON.'))
      }
    })
    req.on('error', reject)
  })
}

export function parseCookies(req: IncomingMessage) {
  const rawCookie = req.headers.cookie || ''
  const pairs = rawCookie.split(';').map((part) => part.trim()).filter(Boolean)
  const output: Record<string, string> = {}
  for (const pair of pairs) {
    const [key, ...rest] = pair.split('=')
    output[key] = decodeURIComponent(rest.join('='))
  }
  return output
}

function cookieFlags(): string {
  const secure =
    process.env.COOKIE_SECURE === 'true' ||
    process.env.NODE_ENV === 'production' ||
    process.env.NETLIFY === 'true'
  // Same-site (eTLD+1) subdomains: Lax is enough for credentialed XHR dashboard ↔ api
  const sameSite = process.env.COOKIE_SAMESITE || 'Lax'
  const parts = ['HttpOnly', 'Path=/', `SameSite=${sameSite}`, 'Max-Age=604800']
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export function setSessionCookie(res: ServerResponse, token: string) {
  res.setHeader('Set-Cookie', `sl_session=${encodeURIComponent(token)}; ${cookieFlags()}`)
}

export function clearSessionCookie(res: ServerResponse) {
  const secure =
    process.env.COOKIE_SECURE === 'true' ||
    process.env.NODE_ENV === 'production' ||
    process.env.NETLIFY === 'true'
  const sameSite = process.env.COOKIE_SAMESITE || 'Lax'
  const parts = ['sl_session=', 'HttpOnly', 'Path=/', `SameSite=${sameSite}`, 'Max-Age=0']
  if (secure) parts.push('Secure')
  res.setHeader('Set-Cookie', parts.join('; '))
}
