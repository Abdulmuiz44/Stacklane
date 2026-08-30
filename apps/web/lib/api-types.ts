export type ResourceStatus = 'provisioning' | 'ready' | 'paused' | 'error'

export type User = {
  id: string
  email: string
  name: string
  status: string
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}


export type Capabilities = {
  canManageProvisioning: boolean
  canManageApiKeys: boolean
  canManageEnvironments: boolean
  canUpdateProject: boolean
}

export type Region = {
  id: string
  code: string
  name: string
  marketScope: string
  deploymentTarget: string
  isActive: boolean
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type Organization = {
  id: string
  name: string
  slug: string
  status: 'active'
  createdAt: string
  updatedAt: string
}

export type Environment = {
  id: string
  projectId: string
  name: string
  slug: string
  status: string
  region: string
  deploymentTarget: string
  createdAt: string
  updatedAt: string
}

export type ApiKey = {
  id: string
  projectId: string | null
  organizationId: string | null
  name: string
  prefix: string
  status: string
  revokedAt: string | null
  lastUsedAt: string | null
  createdAt: string
  updatedAt: string
}

export type ProvisioningAttempt = {
  id: string
  taskId: string
  attemptNo: number
  status: string
  adapter: string
  step: string | null
  errorMessage: string | null
  diagnostics: Record<string, unknown>
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  nextRunAt: string
  claimedBy: string | null
  claimedAt: string | null
  claimExpiresAt: string | null
  lastHeartbeatAt: string | null
  lastTransitionAt: string
}

export type ProvisioningTask = {
  id: string
  projectId: string
  environmentId: string | null
  region: Region | null
  status: 'requested' | 'queued' | 'running' | 'ready' | 'failed' | 'retrying'
  source: string
  requestedByUserId: string | null
  currentAttempt: number
  maxAttempts: number
  lastError: string | null
  diagnostics: Record<string, unknown>
  createdAt: string
  updatedAt: string
  startedAt: string | null
  completedAt: string | null
  nextRunAt: string
  claimedBy: string | null
  claimedAt: string | null
  claimExpiresAt: string | null
  lastHeartbeatAt: string | null
  lastTransitionAt: string
}

export type ProjectRuntimeBinding = {
  id: string
  projectId: string
  regionId: string | null
  databaseRef: string | null
  storageRef: string | null
  authNamespaceRef: string | null
  functionsNamespaceRef: string | null
  status: string
  diagnostics: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type AuditEvent = {
  id: string
  organizationId: string | null
  projectId: string | null
  actorUserId: string | null
  action: string
  targetType: string
  targetId: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export type Project = {
  id: string
  name: string
  slug: string
  status: ResourceStatus
  region: string
  description: string
  organizationId: string
  organization: Organization | null
  createdAt: string
  updatedAt: string
  environments?: Environment[]
  capabilities?: Capabilities
}

export type OrganizationOperationsRow = {
  project: Project
  provisioning: ProvisioningTask | null
  capabilities: Capabilities
}

// ─── Cloud Billing Types ──────────────────────────────────────────

export type CloudWallet = {
  id: string
  projectId: string
  balance: number
  lifetimeCredits: number
  lifetimeSpend: number
  freeCreditsGranted: boolean
  createdAt: string
  updatedAt: string
}

export type TcodeTier = {
  key: string
  minTCODE: number
  monthlyCredits: number
}

export type TcodeHoldings = {
  projectId: string
  walletAddress: string
  rawBalance: string
  decimals: number
  tcodeTokens: number
  tier: TcodeTier | null
  period: string
  claimedThisPeriod: boolean
  linkedAt: string
}

export type TcodeChallenge = {
  nonce: string
  expiresAt: string
  message: string
}

export type TcodeClaimResult = {
  granted: number
  alreadyClaimed: boolean
  reason: string
  period: string
  tier: TcodeTier | null
  tcodeTokens: number
  balance: number | null
  wallet: CloudWallet | null
}

export type CloudTransaction = {
  id: string
  walletId: string
  type: 'charge' | 'topup' | 'grant' | 'refund' | 'tcode_tier'
  creditsDelta: number
  balanceAfter: number
  product: string | null
  action: string | null
  reference: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

export type CloudUsageEvent = {
  id: string
  projectId: string
  apiKeyId: string
  product: string
  action: string
  credits: number
  status: string
  idempotencyKey: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

export type CloudPricingTier = {
  action: string
  product: string
  credits: number
  description: string
}

export type CloudTopupIntent = {
  topup: {
    id: string
    walletId: string
    amount: number
    status: string
  }
  checkoutUrl: string | null
  stripePublishableKey: string | null
  clientSecret: string | null
}

export type CloudTopupResult = {
  topup: {
    id: string
    walletId: string
    amount: number
    status: string
  }
  wallet: CloudWallet
}
