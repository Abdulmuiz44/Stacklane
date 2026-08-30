# $TCODE hold-to-earn

Plan link: Cloud prepaid wallet (`docs/TALOCODE_CLOUD_BILLING.md`)
Architecture link: control-plane billing wallet is the only spendable credit balance
Why now: public dashboard claim was announced; the previous API accepted a client balance and did not prove wallet ownership.

## Behavior

Signed-in project owners link one Solana wallet by signing a server nonce, then claim at most one monthly credit grant from on-chain `$TCODE` holdings. Grants write `stacklane.wallets.balance_credits` and a `tcode_tier` transaction.

Live API implementation: `stacklane-api-deploy` (`/api/v1/cloud/tcode/*`). Dashboard UI: Wallet page (`apps/web`).
