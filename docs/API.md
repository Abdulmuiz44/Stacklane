# Stacklane API

All v0.4.1 endpoints return JSON only.

## Active Runtime

- Active entrypoint: `apps/api/src/server.ts`
- Compatibility shim: `apps/api/src/app.ts`

Legacy compatibility coverage retained from earlier Stacklane releases:

- `GET /health`
- `POST /v1/projects/:id/tokens`
- `POST /v1/tokens/verify`
- `POST /v1/projects/:id/tokens/:tokenId/revoke`

Auth header pattern:

```text
Authorization: Bearer sk_lane_live_...
```

## Health And Config

- `GET /api/v1/health`
- `GET /api/v1/config/status`

## Customers

- `POST /api/v1/customers`
- `GET /api/v1/customers`
- `GET /api/v1/customers/:id`
- `PATCH /api/v1/customers/:id`

## API Keys

- `POST /api/v1/api-keys`
- `GET /api/v1/api-keys`
- `POST /api/v1/api-keys/:id/revoke`
- `POST /api/v1/api-keys/verify`

Raw keys are returned only once on creation. Storage keeps only `keyHash` and `keyPrefix`.

## Usage

Authenticated with `Authorization: Bearer sk_lane_dev_...` or `x-api-key: sk_lane_live_...`.

- `POST /api/v1/usage/events`
- `GET /api/v1/usage/events`
- `GET /api/v1/usage/summary`

## Assets

Authenticated with an active API key.

- `POST /api/v1/assets`
- `GET /api/v1/assets`
- `GET /api/v1/assets/:id`
- `DELETE /api/v1/assets/:id`

`POST /api/v1/assets` accepts metadata-only requests or metadata plus `bytesBase64` for local file persistence.

## Files

- `POST /api/v1/files`

## ScreenLane Image Analysis

Authenticated with `Authorization: Bearer $TALOCODE_API_KEY` or `X-Api-Key: $TALOCODE_API_KEY`.

- `GET /v1/screenlane/health`
- `POST /v1/screenlane/analyze`

`POST /v1/screenlane/analyze` accepts a base64-encoded JPEG, PNG, or WebP image up to 10 MiB after decoding. The request body is limited to 14 MiB to accommodate base64 and JSON overhead. The declared `mimeType` must match the image signature. Requests may set `features` to `text`, `labels`, or both. It returns provider-neutral extracted text and labels:

```json
{
  "imageBase64": "...",
  "mimeType": "image/png",
  "features": ["text", "labels"]
}
```

The endpoint is disabled until `SCREENLANE_VISION_PROVIDER_URL` is configured. That internal adapter URL receives `{ image: { base64, mimeType }, features }` and returns `{ text?, labels?: [{ description, confidence? }] }`, keeping the public Talocode contract independent of its analysis implementation.

## Errors

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "product and filename are required."
  }
}
```

Missing or revoked API keys return JSON `401` errors. Stack traces are not exposed.
