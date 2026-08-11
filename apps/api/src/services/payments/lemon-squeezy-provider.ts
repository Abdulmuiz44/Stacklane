import { createHmac, timingSafeEqual } from 'node:crypto'
import { HttpError } from '../../http'

/**
 * Lemon Squeezy Checkout + webhook helpers for Talocode Cloud credit top-ups.
 *
 * Env:
 *   LEMONSQUEEZY_API_KEY       — API key (Bearer)
 *   LEMONSQUEEZY_STORE_ID      — Store numeric id
 *   LEMONSQUEEZY_VARIANT_ID    — Default variant id (product variant for credits)
 *   LEMONSQUEEZY_WEBHOOK_SECRET — Signing secret for webhooks
 *   LEMONSQUEEZY_VARIANT_MAP   — optional JSON map of credits→variantId e.g. {"500":"111","1000":"222"}
 *   TALOCODE_CLOUD_SUCCESS_URL / TALOCODE_CLOUD_CANCEL_URL — redirect URLs
 */

const API_BASE = 'https://api.lemonsqueezy.com/v1'

export function isLemonSqueezyConfigured(): boolean {
  return Boolean(
    process.env.LEMONSQUEEZY_API_KEY &&
      process.env.LEMONSQUEEZY_STORE_ID &&
      process.env.LEMONSQUEEZY_VARIANT_ID,
  )
}

function requireApiKey(): string {
  const key = process.env.LEMONSQUEEZY_API_KEY
  if (!key) {
    throw new HttpError(
      500,
      'LEMONSQUEEZY_NOT_CONFIGURED',
      'Lemon Squeezy is not configured. Set LEMONSQUEEZY_API_KEY, LEMONSQUEEZY_STORE_ID, LEMONSQUEEZY_VARIANT_ID.',
    )
  }
  return key
}

function resolveVariantId(credits: number): string {
  const mapRaw = process.env.LEMONSQUEEZY_VARIANT_MAP
  if (mapRaw) {
    try {
      const map = JSON.parse(mapRaw) as Record<string, string>
      if (map[String(credits)]) return String(map[String(credits)])
    } catch {
      /* fall through */
    }
  }
  const variant = process.env.LEMONSQUEEZY_VARIANT_ID
  if (!variant) {
    throw new HttpError(
      500,
      'LEMONSQUEEZY_NOT_CONFIGURED',
      'Set LEMONSQUEEZY_VARIANT_ID (or LEMONSQUEEZY_VARIANT_MAP for fixed packs).',
    )
  }
  return variant
}

export async function createLemonSqueezyCheckout(input: {
  topupId: string
  projectId: string
  amountUsd: number
  credits: number
  successUrl?: string
  cancelUrl?: string
  email?: string
}): Promise<{ checkoutId: string; checkoutUrl: string }> {
  const apiKey = requireApiKey()
  const storeId = process.env.LEMONSQUEEZY_STORE_ID!
  const variantId = resolveVariantId(input.credits)
  const successUrl =
    input.successUrl ||
    process.env.TALOCODE_CLOUD_SUCCESS_URL ||
    'https://dashboard.talocode.site/billing?topup=success'
  const cancelUrl =
    input.cancelUrl ||
    process.env.TALOCODE_CLOUD_CANCEL_URL ||
    'https://dashboard.talocode.site/billing?topup=cancel'

  // custom_price is cents; works when the variant allows custom pricing / PWYW.
  // If you use fixed variants via LEMONSQUEEZY_VARIANT_MAP, price comes from the variant.
  const customPriceCents = Math.round(input.amountUsd * 100)
  const useCustomPrice = !process.env.LEMONSQUEEZY_VARIANT_MAP

  const attributes: Record<string, unknown> = {
    checkout_options: {
      embed: false,
      media: false,
      logo: true,
    },
    checkout_data: {
      email: input.email || undefined,
      custom: {
        topup_id: input.topupId,
        project_id: input.projectId,
        credits: String(input.credits),
        amount_usd: String(input.amountUsd),
        provider: 'lemonsqueezy',
      },
    },
    product_options: {
      name: `Talocode Cloud — ${input.credits.toLocaleString()} credits`,
      description: `${input.credits.toLocaleString()} prepaid credits (1 credit = $0.01).`,
      redirect_url: successUrl,
      receipt_button_text: 'Return to dashboard',
      receipt_link_url: successUrl,
    },
    expires_at: null,
    preview: false,
    test_mode: process.env.LEMONSQUEEZY_TEST_MODE === 'true',
  }

  if (useCustomPrice) {
    attributes.custom_price = customPriceCents
  }

  const body = {
    data: {
      type: 'checkouts',
      attributes,
      relationships: {
        store: { data: { type: 'stores', id: String(storeId) } },
        variant: { data: { type: 'variants', id: String(variantId) } },
      },
    },
  }

  const res = await fetch(`${API_BASE}/checkouts`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  const json = (await res.json().catch(() => ({}))) as {
    data?: { id?: string; attributes?: { url?: string } }
    errors?: Array<{ detail?: string; title?: string }>
  }

  if (!res.ok) {
    const detail =
      json.errors?.map((e) => e.detail || e.title).filter(Boolean).join('; ') ||
      `Lemon Squeezy checkout failed (${res.status})`
    throw new HttpError(502, 'LEMONSQUEEZY_CHECKOUT_FAILED', detail)
  }

  const checkoutUrl = json.data?.attributes?.url
  const checkoutId = json.data?.id
  if (!checkoutUrl || !checkoutId) {
    throw new HttpError(502, 'LEMONSQUEEZY_CHECKOUT_FAILED', 'Checkout response missing url.')
  }

  // cancel URL is handled by user closing checkout; success uses product_options.redirect_url
  void cancelUrl

  return { checkoutId, checkoutUrl }
}

export function verifyLemonSqueezySignature(rawBody: string | Buffer, signatureHeader: string | undefined): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET
  if (!secret) {
    throw new HttpError(
      500,
      'WEBHOOK_NOT_CONFIGURED',
      'Lemon Squeezy webhook is not configured. Set LEMONSQUEEZY_WEBHOOK_SECRET.',
    )
  }
  if (!signatureHeader) return false
  const hmac = createHmac('sha256', secret)
  hmac.update(typeof rawBody === 'string' ? rawBody : rawBody)
  const digest = hmac.digest('hex')
  try {
    const a = Buffer.from(digest, 'utf8')
    const b = Buffer.from(signatureHeader, 'utf8')
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export type LemonWebhookEvent = {
  meta: {
    event_name: string
    custom_data?: Record<string, string>
  }
  data: {
    id: string
    type: string
    attributes: Record<string, unknown>
  }
}

export function parseLemonSqueezyWebhook(rawBody: string, signature: string | undefined): LemonWebhookEvent {
  if (!verifyLemonSqueezySignature(rawBody, signature)) {
    throw new HttpError(400, 'INVALID_SIGNATURE', 'Invalid Lemon Squeezy webhook signature.')
  }
  try {
    return JSON.parse(rawBody) as LemonWebhookEvent
  } catch {
    throw new HttpError(400, 'INVALID_PAYLOAD', 'Invalid Lemon Squeezy webhook JSON.')
  }
}
