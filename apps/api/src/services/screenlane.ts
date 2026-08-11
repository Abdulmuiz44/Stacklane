const MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const MAX_SCREENLANE_REQUEST_BYTES = 14 * 1024 * 1024
const SUPPORTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const SUPPORTED_FEATURES = new Set(['text', 'labels'])

export type ScreenLaneFeature = 'text' | 'labels'

export interface ScreenLaneAnalysisInput {
  imageBase64: string
  mimeType: string
  features?: ScreenLaneFeature[]
}

export interface ScreenLaneLabel {
  description: string
  confidence?: number
}

export interface ScreenLaneAnalysisResult {
  provider: 'talocode'
  text?: string
  labels: ScreenLaneLabel[]
}

interface VisionProvider {
  analyze(input: Required<ScreenLaneAnalysisInput>): Promise<Omit<ScreenLaneAnalysisResult, 'provider'>>
}

export class VisionProviderUnavailableError extends Error {
  constructor() {
    super('Image analysis is not configured. Set SCREENLANE_VISION_PROVIDER_URL before using this endpoint.')
  }
}

export class ScreenLaneInputError extends Error {}

export class VisionProviderTimeoutError extends Error {
  constructor() {
    super('Image analysis provider timed out.')
  }
}

export class VisionProviderResponseError extends Error {}

function providerTimeoutMs(): number {
  const configured = Number(process.env.SCREENLANE_VISION_PROVIDER_TIMEOUT_MS)
  return Number.isFinite(configured) && configured > 0 ? Math.min(configured, 25_000) : 25_000
}

function detectedMimeType(bytes: Buffer): string | undefined {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp'
  return undefined
}

function normalizeInput(input: ScreenLaneAnalysisInput): Required<ScreenLaneAnalysisInput> {
  const imageBase64 = input.imageBase64?.trim()
  if (!imageBase64) throw new ScreenLaneInputError('imageBase64 is required.')
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(imageBase64)) {
    throw new ScreenLaneInputError('imageBase64 must be standard base64 without a data URL prefix.')
  }

  const bytes = Buffer.from(imageBase64, 'base64')
  if (!bytes.length || bytes.toString('base64') !== imageBase64) {
    throw new ScreenLaneInputError('imageBase64 is invalid.')
  }
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new ScreenLaneInputError(`imageBase64 must decode to ${MAX_IMAGE_BYTES / 1024 / 1024} MiB or less.`)
  }

  const mimeType = input.mimeType?.trim().toLowerCase()
  if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
    throw new ScreenLaneInputError('mimeType must be image/jpeg, image/png, or image/webp.')
  }
  const detectedMime = detectedMimeType(bytes)
  if (!detectedMime) {
    throw new ScreenLaneInputError('imageBase64 must contain a JPEG, PNG, or WebP image.')
  }
  if (detectedMime !== mimeType) {
    throw new ScreenLaneInputError('mimeType does not match the image signature.')
  }

  const features = input.features?.length ? input.features : ['text', 'labels']
  if (features.some((feature) => !SUPPORTED_FEATURES.has(feature))) {
    throw new ScreenLaneInputError('features may only include text and labels.')
  }

  return { imageBase64, mimeType, features: [...new Set(features)] as ScreenLaneFeature[] }
}

function configuredProvider(): VisionProvider {
  const endpoint = process.env.SCREENLANE_VISION_PROVIDER_URL?.replace(/\/+$/, '')
  if (!endpoint) {
    return { analyze: async () => { throw new VisionProviderUnavailableError() } }
  }

  return {
    async analyze(input) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), providerTimeoutMs())
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(process.env.SCREENLANE_VISION_PROVIDER_TOKEN
              ? { authorization: `Bearer ${process.env.SCREENLANE_VISION_PROVIDER_TOKEN}` }
              : {}),
          },
          body: JSON.stringify({ image: { base64: input.imageBase64, mimeType: input.mimeType }, features: input.features }),
          signal: controller.signal,
        })
        const payload: unknown = await response.json().catch(() => null)
        if (!response.ok) throw new VisionProviderResponseError('Image analysis provider returned an error.')
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
          throw new VisionProviderResponseError('Image analysis provider returned an invalid response.')
        }

        const result = payload as Record<string, unknown>
        if (!Object.hasOwn(result, 'text') && !Object.hasOwn(result, 'labels')) {
          throw new VisionProviderResponseError('Image analysis provider returned an invalid response.')
        }
        if (result.text !== undefined && typeof result.text !== 'string') {
          throw new VisionProviderResponseError('Image analysis provider returned an invalid response.')
        }
        if (result.labels !== undefined && !Array.isArray(result.labels)) {
          throw new VisionProviderResponseError('Image analysis provider returned an invalid response.')
        }

        const labels = (result.labels ?? []).map((label) => {
          if (!label || typeof label !== 'object' || Array.isArray(label)) {
            throw new VisionProviderResponseError('Image analysis provider returned an invalid response.')
          }
          const value = label as Record<string, unknown>
          if (typeof value.description !== 'string' || !value.description.trim()) {
            throw new VisionProviderResponseError('Image analysis provider returned an invalid response.')
          }
          if (value.confidence !== undefined && (typeof value.confidence !== 'number' || value.confidence < 0 || value.confidence > 1)) {
            throw new VisionProviderResponseError('Image analysis provider returned an invalid response.')
          }
          return { description: value.description, confidence: value.confidence as number | undefined }
        })

        return { text: result.text as string | undefined, labels }
      } catch (error) {
        if (controller.signal.aborted) throw new VisionProviderTimeoutError()
        if (error instanceof VisionProviderResponseError) throw error
        throw new VisionProviderResponseError('Image analysis provider request failed.')
      } finally {
        clearTimeout(timeout)
      }
    },
  }
}

export async function analyzeScreenImage(input: ScreenLaneAnalysisInput): Promise<ScreenLaneAnalysisResult> {
  const result = await configuredProvider().analyze(normalizeInput(input))
  return { provider: 'talocode', ...result }
}
