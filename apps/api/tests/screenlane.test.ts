import assert from 'node:assert/strict'
import test from 'node:test'
import { Readable } from 'node:stream'
import { HttpError, parseBody } from '../src/http.ts'
import {
  analyzeScreenImage,
  MAX_SCREENLANE_REQUEST_BYTES,
  ScreenLaneInputError,
  VisionProviderResponseError,
  VisionProviderTimeoutError,
  VisionProviderUnavailableError,
} from '../src/services/screenlane.ts'

const ONE_PIXEL_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

test('ScreenLane rejects malformed image input before calling a provider', async () => {
  await assert.rejects(
    () => analyzeScreenImage({ imageBase64: 'not-base64!', mimeType: 'image/png' }),
    ScreenLaneInputError,
  )
})

test('ScreenLane rejects unsupported and mismatched image signatures', async () => {
  await assert.rejects(
    () => analyzeScreenImage({ imageBase64: Buffer.from('not an image').toString('base64'), mimeType: 'image/png' }),
    ScreenLaneInputError,
  )
  await assert.rejects(
    () => analyzeScreenImage({ imageBase64: ONE_PIXEL_PNG, mimeType: 'image/jpeg' }),
    /signature/i,
  )
})

test('ScreenLane limits encoded request bodies before buffering them', async () => {
  const request = Readable.from([]) as Readable & { headers: Record<string, string> }
  request.headers = { 'content-length': String(MAX_SCREENLANE_REQUEST_BYTES + 1) }
  await assert.rejects(
    () => parseBody(request as never, MAX_SCREENLANE_REQUEST_BYTES),
    (error: unknown) => error instanceof HttpError && error.statusCode === 413 && error.code === 'PAYLOAD_TOO_LARGE',
  )
})

test('ScreenLane stops reading an oversized streamed request body', async () => {
  const request = Readable.from([Buffer.alloc(MAX_SCREENLANE_REQUEST_BYTES + 1)]) as Readable & { headers: Record<string, string> }
  request.headers = {}
  await assert.rejects(
    () => parseBody(request as never, MAX_SCREENLANE_REQUEST_BYTES),
    (error: unknown) => error instanceof HttpError && error.statusCode === 413 && error.code === 'PAYLOAD_TOO_LARGE',
  )
})

test('ScreenLane accepts supported image input but stays disabled without an adapter', async () => {
  const previousEndpoint = process.env.SCREENLANE_VISION_PROVIDER_URL
  delete process.env.SCREENLANE_VISION_PROVIDER_URL
  try {
    await assert.rejects(
      () => analyzeScreenImage({ imageBase64: ONE_PIXEL_PNG, mimeType: 'image/png', features: ['text'] }),
      VisionProviderUnavailableError,
    )
  } finally {
    if (previousEndpoint) process.env.SCREENLANE_VISION_PROVIDER_URL = previousEndpoint
  }
})

test('ScreenLane cancels a provider request that exceeds its timeout', async () => {
  const originalFetch = globalThis.fetch
  const previousEndpoint = process.env.SCREENLANE_VISION_PROVIDER_URL
  const previousTimeout = process.env.SCREENLANE_VISION_PROVIDER_TIMEOUT_MS
  process.env.SCREENLANE_VISION_PROVIDER_URL = 'https://adapter.invalid/analyze'
  process.env.SCREENLANE_VISION_PROVIDER_TIMEOUT_MS = '10'
  globalThis.fetch = ((_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
  })) as typeof fetch
  try {
    await assert.rejects(
      () => analyzeScreenImage({ imageBase64: ONE_PIXEL_PNG, mimeType: 'image/png' }),
      VisionProviderTimeoutError,
    )
  } finally {
    globalThis.fetch = originalFetch
    if (previousEndpoint) process.env.SCREENLANE_VISION_PROVIDER_URL = previousEndpoint
    else delete process.env.SCREENLANE_VISION_PROVIDER_URL
    if (previousTimeout) process.env.SCREENLANE_VISION_PROVIDER_TIMEOUT_MS = previousTimeout
    else delete process.env.SCREENLANE_VISION_PROVIDER_TIMEOUT_MS
  }
})

test('ScreenLane rejects non-success and malformed provider responses without returning their contents', async () => {
  const originalFetch = globalThis.fetch
  const previousEndpoint = process.env.SCREENLANE_VISION_PROVIDER_URL
  process.env.SCREENLANE_VISION_PROVIDER_URL = 'https://adapter.invalid/analyze'
  try {
    globalThis.fetch = (async () => new Response(JSON.stringify({ message: 'provider details' }), { status: 500 })) as typeof fetch
    await assert.rejects(
      () => analyzeScreenImage({ imageBase64: ONE_PIXEL_PNG, mimeType: 'image/png' }),
      VisionProviderResponseError,
    )

    globalThis.fetch = (async () => new Response(JSON.stringify({ text: 12 }), { status: 200 })) as typeof fetch
    await assert.rejects(
      () => analyzeScreenImage({ imageBase64: ONE_PIXEL_PNG, mimeType: 'image/png' }),
      VisionProviderResponseError,
    )
  } finally {
    globalThis.fetch = originalFetch
    if (previousEndpoint) process.env.SCREENLANE_VISION_PROVIDER_URL = previousEndpoint
    else delete process.env.SCREENLANE_VISION_PROVIDER_URL
  }
})
