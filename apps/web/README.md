# Talocode Cloud Dashboard

Production dashboard for **Talocode Cloud** — projects, organizations, API keys, prepaid wallet, usage, and pricing.

- **URL (target):** https://dashboard.talocode.site  
- **API:** https://api.talocode.site (`NEXT_PUBLIC_API_BASE_URL`)

## Features

- Clean dark / light interface  
- Overview with wallet snapshot and product namespaces  
- Organizations & projects  
- API key create / revoke (secret shown once)  
- Wallet top-up (Stripe embedded checkout when configured)  
- Usage events and pricing catalog  
- Settings (account + theme)  

Infrastructure / legacy Stacklane panels are removed from navigation and redirect home.

## Local development

```bash
cd apps/web
npm install
export NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
npm run dev
```

Open http://localhost:3000

## Netlify deploy

Use base directory `Stacklane/apps/web` (or monorepo path that contains this app).

```toml
# apps/web/netlify.toml (included)
```

Required env:

```
NEXT_PUBLIC_API_BASE_URL=https://api.talocode.site
```

Install Netlify Next.js runtime plugin (`@netlify/plugin-nextjs` is referenced in `netlify.toml`).

## Auth

Session cookie: `sl_session` (set by Stacklane API login).  
Middleware redirects unauthenticated users to `/signin`.

## Version

1.0.0 — Talocode Cloud only
