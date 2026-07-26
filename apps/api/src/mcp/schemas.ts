import type { McpToolInputSchema } from './types'

export const teraWritingRewriteSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    text: { type: 'string', description: 'The text to rewrite' },
    style: { type: 'string', description: 'Target style (e.g. "clear", "concise", "professional")' },
    tone: { type: 'string', description: 'Target tone (e.g. "formal", "casual", "friendly")' },
    maxLength: { type: 'number', description: 'Maximum output length in characters' },
  },
  required: ['text'],
  additionalProperties: false,
}

export const teraWritingDraftSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['email', 'social_post', 'announcement', 'article', 'doc', 'custom'], description: 'Type of content to draft' },
    brief: { type: 'string', description: 'Brief description of what to write' },
    audience: { type: 'string', description: 'Target audience' },
    tone: { type: 'string', description: 'Desired tone' },
    maxLength: { type: 'number', description: 'Maximum output length' },
    points: { type: 'array', items: { type: 'string' }, description: 'Key points to include' },
  },
  required: ['type', 'brief'],
  additionalProperties: false,
}

export const teraCodingExplainSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    language: { type: 'string', description: 'Programming language' },
    code: { type: 'string', description: 'Code snippet to explain' },
    level: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'], description: 'Explanation depth' },
    focus: { type: 'array', items: { type: 'string' }, description: 'Aspects to focus on' },
  },
  required: ['language', 'code'],
  additionalProperties: false,
}

export const teraCodingReviewSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    language: { type: 'string', description: 'Programming language' },
    code: { type: 'string', description: 'Code to review' },
    focus: { type: 'array', items: { type: 'string' }, description: 'Aspects to review (bugs, security, performance, etc.)' },
    strictness: { type: 'string', enum: ['gentle', 'normal', 'strict'], description: 'Review strictness' },
  },
  required: ['language', 'code'],
  additionalProperties: false,
}

export const agentBrowserCheckSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    url: { type: 'string', description: 'URL to check' },
    screenshot: { type: 'boolean', description: 'Capture screenshot' },
    vision: { type: 'boolean', description: 'Use vision analysis' },
    sessionId: { type: 'string', description: 'Browser session ID' },
  },
  required: ['url'],
  additionalProperties: false,
}

export const agentBrowserScreenshotSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    url: { type: 'string', description: 'URL to screenshot' },
    fullPage: { type: 'boolean', description: 'Capture full page' },
    width: { type: 'number', description: 'Viewport width' },
    height: { type: 'number', description: 'Viewport height' },
    sessionId: { type: 'string', description: 'Browser session ID' },
  },
  required: ['url'],
  additionalProperties: false,
}

export const agentBrowserTraceReportSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    url: { type: 'string', description: 'URL to trace' },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          action: { type: 'string', description: 'Action type (click, type, navigate, etc.)' },
          selector: { type: 'string', description: 'CSS selector for target element' },
          value: { type: 'string', description: 'Value to type or input' },
        },
        required: ['action'],
      },
      description: 'Steps to execute',
    },
    sessionId: { type: 'string', description: 'Browser session ID' },
  },
  required: ['url', 'steps'],
  additionalProperties: false,
}

export const agentBrowserExtractSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    url: { type: 'string', description: 'URL to extract content from' },
    includeImages: { type: 'boolean', description: 'Include images from page (default: true)' },
    includeLinks: { type: 'boolean', description: 'Include links from page (default: true)' },
    maxTextLength: { type: 'number', description: 'Maximum text content length (default: 50000)' },
  },
  required: ['url'],
  additionalProperties: false,
}

export const agentBrowserAnalyzeSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    url: { type: 'string', description: 'URL to analyze' },
    analysis: {
      type: 'array',
      items: { type: 'string', enum: ['summary', 'sentiment', 'entities', 'topics', 'keywords'] },
      description: 'Types of analysis to perform (default: all)',
    },
    maxTextLength: { type: 'number', description: 'Maximum text to analyze (default: 8000)' },
  },
  required: ['url'],
  additionalProperties: false,
}

export const cliploopBriefGenerateSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    prompt: { type: 'string', description: 'Video concept or prompt' },
    channel: { type: 'string', enum: ['youtube', 'tiktok', 'instagram', 'twitter', 'linkedin'], description: 'Target platform' },
    tone: { type: 'string', description: 'Video tone' },
    duration: { type: 'number', description: 'Target duration in seconds' },
    cta: { type: 'string', description: 'Call to action' },
  },
  required: ['prompt'],
  additionalProperties: false,
}

export const cliploopScriptGenerateSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    briefId: { type: 'string', description: 'Brief ID from brief generation' },
    style: { type: 'string', description: 'Script style' },
  },
  required: ['briefId'],
  additionalProperties: false,
}

export const cliploopVideoRenderSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    scriptId: { type: 'string', description: 'Script ID from script generation' },
    format: { type: 'string', enum: ['portrait', 'landscape', 'square'], description: 'Video format' },
    quality: { type: 'string', enum: ['draft', 'standard', 'high'], description: 'Render quality' },
  },
  required: ['scriptId'],
  additionalProperties: false,
}

export const cliploopCampaignCreateSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Campaign name' },
    platform: { type: 'string', description: 'Target platform' },
    schedule: { type: 'string', description: 'Schedule (ISO date or cron-like)' },
  },
  required: ['name', 'platform'],
  additionalProperties: false,
}

export const cliploopCampaignPackageSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    campaignId: { type: 'string', description: 'Campaign ID' },
  },
  required: ['campaignId'],
  additionalProperties: false,
}

export const cloudPricingSchema: McpToolInputSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
}

export const skillsGenerateProfileSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    username: { type: 'string', description: 'GitHub username to generate skill from' },
    target: { type: 'string', enum: ['cursor', 'claude', 'opencode', 'codra'], description: 'Target AI agent platform' },
    focus: { type: 'array', items: { type: 'string' }, description: 'Focus areas for the skill' },
    includeRepositories: { type: 'boolean', description: 'Whether to include repo analysis' },
    maxRepositories: { type: 'number', description: 'Maximum number of repos to analyze' },
  },
  required: ['username'],
  additionalProperties: false,
}

export const skillsGenerateRepoSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    repoUrl: { type: 'string', description: 'Full GitHub repository URL' },
    target: { type: 'string', enum: ['cursor', 'claude', 'opencode', 'codra'], description: 'Target AI agent platform' },
    focus: { type: 'array', items: { type: 'string' }, description: 'Focus areas for the skill' },
  },
  required: ['repoUrl'],
  additionalProperties: false,
}

export const skillsGenerateDocsSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    url: { type: 'string', description: 'Documentation URL to generate skill from' },
    target: { type: 'string', enum: ['cursor', 'claude', 'opencode', 'codra'], description: 'Target AI agent platform' },
    focus: { type: 'array', items: { type: 'string' }, description: 'Focus areas for the skill' },
  },
  required: ['url'],
  additionalProperties: false,
}

export const skillsGenerateTextSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Name for the generated skill' },
    content: { type: 'string', description: 'Text content to generate skill from' },
    target: { type: 'string', enum: ['cursor', 'claude', 'opencode', 'codra'], description: 'Target AI agent platform' },
    focus: { type: 'array', items: { type: 'string' }, description: 'Focus areas for the skill' },
  },
  required: ['name', 'content'],
  additionalProperties: false,
}

export const skillsGenerateRecordingSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    recordingUrl: { type: 'string', description: 'URL of screen recording video (MP4, WebM)' },
    target: { type: 'string', enum: ['cursor', 'claude', 'opencode', 'codra'], description: 'Target AI agent platform' },
    focus: { type: 'array', items: { type: 'string' }, description: 'Focus areas for the skill' },
    frameDescriptions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          timestamp: { type: 'number' },
          description: { type: 'string' },
          actions: { type: 'array', items: { type: 'string' } },
          uiElements: { type: 'array', items: { type: 'string' } },
        },
      },
      description: 'Optional pre-analyzed frame descriptions',
    },
  },
  required: ['recordingUrl'],
  additionalProperties: false,
}

export const skillsExportCursorSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    skill: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Skill name' },
        skillMd: { type: 'string', description: 'Skill markdown content' },
        title: { type: 'string', description: 'Skill title' },
        description: { type: 'string', description: 'Skill description' },
        metadata: { type: 'object', description: 'Optional metadata' },
      },
      required: ['name', 'skillMd'],
      description: 'Skill object to export',
    },
  },
  required: ['skill'],
  additionalProperties: false,
}

export const invoicelaneHealthSchema: McpToolInputSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
}

export const invoicelanePricingSchema: McpToolInputSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
}

export const invoicelaneCapabilitiesSchema: McpToolInputSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
}

export const invoicelaneExtractSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    text: {
      type: 'string',
      description:
        'Raw text from an invoice or receipt (required). OCR/PDF not supported in v0.2 — extract text first.',
    },
    type: {
      type: 'string',
      enum: ['invoice', 'receipt', 'document', 'auto'],
      description: 'Document type hint. Auto-detect if omitted.',
    },
    currency: { type: 'string', description: 'Expected currency code (e.g. NGN, USD, EUR, GBP)' },
    locale: { type: 'string', description: 'Locale for parsing (e.g. en-NG, en-US)' },
    fileUrl: {
      type: 'string',
      description: 'URL to a document file — returns OCR_NOT_AVAILABLE unless text is also provided',
    },
    base64: {
      type: 'string',
      description: 'Base64 document — returns OCR_NOT_AVAILABLE unless text is also provided',
    },
  },
  required: [],
  additionalProperties: false,
}

export const invoicelaneExtractReceiptSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    text: {
      type: 'string',
      description: 'Raw receipt text. Returns receiptNumber, merchant/vendor, total, date, missingFields, totalsConsistent.',
    },
    currency: { type: 'string', description: 'Expected currency code (e.g. NGN, USD)' },
    locale: { type: 'string', description: 'Locale for parsing' },
    fileUrl: { type: 'string', description: 'Document URL (OCR not available — provide text)' },
    base64: { type: 'string', description: 'Base64 document (OCR not available — provide text)' },
  },
  required: [],
  additionalProperties: false,
}

export const invoicelaneExtractInvoiceSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    text: {
      type: 'string',
      description:
        'Raw invoice text. Returns invoiceNumber, vendor, total, subtotal, tax, line items, missingFields, totalsConsistent. Invoice schema requires: invoiceNumber, total, currency, date.',
    },
    currency: { type: 'string', description: 'Expected currency code (e.g. NGN, USD)' },
    locale: { type: 'string', description: 'Locale for parsing' },
    fileUrl: { type: 'string', description: 'Document URL (OCR not available — provide text)' },
    base64: { type: 'string', description: 'Base64 document (OCR not available — provide text)' },
  },
  required: [],
  additionalProperties: false,
}

export const invoicelaneValidateSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    documentType: {
      type: 'string',
      description: 'Document type: invoice (requires invoiceNumber, total, currency, date) or receipt (requires total, currency, date)',
    },
    fields: {
      type: 'object',
      description:
        'Extracted fields to validate against the schema contract. Checks required fields, number types, and totals consistency (subtotal + tax - discount ≈ total).',
      additionalProperties: true,
    },
  },
  required: ['documentType', 'fields'],
  additionalProperties: false,
}

export const invoicelaneExportCsvSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    rows: {
      type: 'array',
      items: { type: 'object' },
      description: 'Array of row objects (e.g. extracted invoices) to export as CSV',
    },
  },
  required: ['rows'],
  additionalProperties: false,
}

export const geolaneHealthSchema: McpToolInputSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
}

export const geolanePricingSchema: McpToolInputSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
}

export const geolaneCapabilitiesSchema: McpToolInputSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
}

export const geolaneAuditSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    url: {
      type: 'string',
      description: 'Public page or domain URL to audit for AI search visibility (GEO)',
    },
  },
  required: ['url'],
  additionalProperties: false,
}

export const geolaneCrawlersSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    url: {
      type: 'string',
      description: 'URL whose origin robots.txt will be checked against major AI crawlers (GPTBot, ClaudeBot, PerplexityBot, etc.)',
    },
  },
  required: ['url'],
  additionalProperties: false,
}

export const geolaneLlmsTxtSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    url: {
      type: 'string',
      description: 'Site URL — checks /llms.txt, scores quality, and returns a ready-to-publish draft',
    },
  },
  required: ['url'],
  additionalProperties: false,
}

export const geolaneCitationReadinessSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    url: {
      type: 'string',
      description: 'Page URL to score for AI citation readiness (structure, schema, E-E-A-T, passage length)',
    },
  },
  required: ['url'],
  additionalProperties: false,
}

export const geolaneCompareSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    urlA: { type: 'string', description: 'First domain/page URL' },
    urlB: { type: 'string', description: 'Second domain/page URL' },
    a: { type: 'string', description: 'Alias for urlA' },
    b: { type: 'string', description: 'Alias for urlB' },
  },
  required: [],
  additionalProperties: false,
}

export const searchlaneHealthSchema: McpToolInputSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
}

export const searchlanePricingSchema: McpToolInputSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
}

export const searchlaneCapabilitiesSchema: McpToolInputSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
}

export const searchlaneQuerySchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    query: { type: 'string', description: 'Search query string' },
    q: { type: 'string', description: 'Alias for query' },
    limit: { type: 'number', description: 'Max results (1–20, default 8)' },
  },
  required: [],
  additionalProperties: false,
}

export const searchlaneNewsSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    query: { type: 'string', description: 'News search query' },
    q: { type: 'string', description: 'Alias for query' },
    limit: { type: 'number', description: 'Max results (1–20)' },
  },
  required: [],
  additionalProperties: false,
}

export const searchlaneResearchSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    query: { type: 'string', description: 'Research question or topic' },
    q: { type: 'string', description: 'Alias for query' },
    limit: { type: 'number', description: 'Max sources (3–12)' },
    fetchPages: {
      type: 'boolean',
      description: 'Peek top result pages for richer snippets (default true)',
    },
  },
  required: [],
  additionalProperties: false,
}

export const webdatalaneFetchSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    url: { type: 'string', description: 'URL to fetch' },
    timeoutMs: { type: 'number', description: 'Request timeout in milliseconds' },
    userAgent: { type: 'string', description: 'Custom User-Agent string' },
    maxBytes: { type: 'number', description: 'Maximum response bytes' },
  },
  required: ['url'],
  additionalProperties: false,
}

export const webdatalaneExtractSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    url: { type: 'string', description: 'URL to extract from' },
    html: { type: 'string', description: 'Raw HTML to extract from' },
    include: { type: 'array', items: { type: 'string' }, description: 'Fields to include: metadata, links, markdown, headings, images, jsonLd, tables' },
    timeoutMs: { type: 'number', description: 'Request timeout' },
  },
  required: [],
  additionalProperties: false,
}

export const webdatalaneMarkdownSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    url: { type: 'string', description: 'URL to convert' },
    html: { type: 'string', description: 'Raw HTML to convert' },
    stripNavigation: { type: 'boolean', description: 'Strip nav/footer/header elements' },
    includeLinks: { type: 'boolean', description: 'Include links in output' },
  },
  required: [],
  additionalProperties: false,
}

export const webdatalaneMetadataSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    url: { type: 'string', description: 'URL to extract metadata from' },
    html: { type: 'string', description: 'Raw HTML' },
  },
  required: [],
  additionalProperties: false,
}

export const webdatalaneLinksSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    url: { type: 'string', description: 'URL to extract links from' },
    html: { type: 'string', description: 'Raw HTML' },
    internalOnly: { type: 'boolean', description: 'Only return internal links' },
  },
  required: [],
  additionalProperties: false,
}

export const webdatalaneStructuredSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    url: { type: 'string', description: 'URL to extract from' },
    html: { type: 'string', description: 'Raw HTML' },
    schema: { type: 'object', description: 'Schema of fields to extract (key: type)' },
    hints: { type: 'object', description: 'Hints for field extraction (key: [selectors])' },
  },
  required: ['schema'],
  additionalProperties: false,
}

export const webdatalaneCrawlPlanSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    url: { type: 'string', description: 'Seed URL for crawl' },
    html: { type: 'string', description: 'Raw HTML' },
    maxPages: { type: 'number', description: 'Maximum pages to crawl' },
    sameDomainOnly: { type: 'boolean', description: 'Only include same-domain links' },
    includePatterns: { type: 'array', items: { type: 'string' }, description: 'URL patterns to include' },
    excludePatterns: { type: 'array', items: { type: 'string' }, description: 'URL patterns to exclude' },
  },
  required: ['url'],
  additionalProperties: false,
}

export const webdatalaneScreenshotSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    url: { type: 'string', description: 'URL to screenshot' },
    width: { type: 'number', description: 'Viewport width' },
    height: { type: 'number', description: 'Viewport height' },
    fullPage: { type: 'boolean', description: 'Capture full page' },
  },
  required: ['url'],
  additionalProperties: false,
}

const crawlerlaneLogEventSchema = {
  type: 'object',
  properties: {
    timestamp: { type: 'string', description: 'ISO timestamp' },
    method: { type: 'string', description: 'HTTP method' },
    path: { type: 'string', description: 'Request path' },
    status: { type: 'number', description: 'HTTP status code' },
    userAgent: { type: 'string', description: 'User-Agent header' },
    referer: { type: 'string', description: 'Referer header' },
    ip: { type: 'string', description: 'Redacted or hashed IP (never submit raw IPs)' },
    host: { type: 'string', description: 'Hostname' },
  },
  required: ['timestamp', 'method', 'path', 'status', 'userAgent'],
}

const crawlerlanePrivacySchema = {
  type: 'object',
  properties: {
    redactIps: { type: 'boolean', description: 'Redact/hash IP addresses in logs (default true)' },
  },
}

export const crawlerlaneLogsIngestSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    domain: { type: 'string', description: 'Domain you own (e.g. talocode.site)' },
    logs: {
      type: 'array',
      items: crawlerlaneLogEventSchema,
      description: 'Request logs from your website. Logs may contain sensitive data — redact IPs before sending.',
    },
    privacy: crawlerlanePrivacySchema,
  },
  required: ['domain', 'logs'],
  additionalProperties: false,
}

export const crawlerlaneBotsClassifySchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    userAgent: { type: 'string', description: 'User-Agent string to classify (heuristic only)' },
    ip: { type: 'string', description: 'Optional redacted IP' },
    path: { type: 'string', description: 'Request path' },
    status: { type: 'number', description: 'HTTP status' },
  },
  required: ['userAgent'],
  additionalProperties: false,
}

export const crawlerlanePagesAnalyzeSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    domain: { type: 'string', description: 'Domain you own' },
    logs: { type: 'array', items: crawlerlaneLogEventSchema, description: 'Access logs (IPs should be redacted)' },
    importantPages: { type: 'array', items: { type: 'string' }, description: 'Important pages to check crawl coverage' },
    privacy: crawlerlanePrivacySchema,
  },
  required: ['domain', 'logs'],
  additionalProperties: false,
}

export const crawlerlane404AnalyzeSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    domain: { type: 'string', description: 'Domain you own' },
    logs: { type: 'array', items: crawlerlaneLogEventSchema, description: 'Access logs (IPs should be redacted)' },
    privacy: crawlerlanePrivacySchema,
  },
  required: ['domain', 'logs'],
  additionalProperties: false,
}

export const crawlerlaneAiVisibilityScoreSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    domain: { type: 'string', description: 'Domain you own' },
    logs: { type: 'array', items: crawlerlaneLogEventSchema, description: 'Access logs (IPs should be redacted)' },
    importantPages: { type: 'array', items: { type: 'string' } },
    hasLlmsTxt: { type: 'boolean' },
    hasSitemap: { type: 'boolean' },
    hasRobotsTxt: { type: 'boolean' },
    privacy: crawlerlanePrivacySchema,
  },
  required: ['domain', 'logs'],
  additionalProperties: false,
}

export const crawlerlaneReportGenerateSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    domain: { type: 'string', description: 'Domain you own' },
    logs: { type: 'array', items: crawlerlaneLogEventSchema, description: 'Access logs (IPs should be redacted)' },
    period: { type: 'string', description: 'Report period (e.g. 7d)' },
    importantPages: { type: 'array', items: { type: 'string' } },
    privacy: crawlerlanePrivacySchema,
  },
  required: ['domain', 'logs'],
  additionalProperties: false,
}

export const crawlerlaneSitemapSuggestSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    domain: { type: 'string', description: 'Domain you own' },
    existingPages: { type: 'array', items: { type: 'string' } },
    requested404s: { type: 'array', items: { type: 'string' } },
    importantPages: { type: 'array', items: { type: 'string' } },
  },
  required: ['domain'],
  additionalProperties: false,
}

export const crawlerlaneRobotsAuditSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    domain: { type: 'string', description: 'Domain you own' },
    robotsTxt: { type: 'string', description: 'robots.txt content' },
    sitemapUrl: { type: 'string', description: 'Sitemap URL' },
  },
  required: ['domain', 'robotsTxt'],
  additionalProperties: false,
}

export const crawlerlaneExportMarkdownSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    report: { type: 'object', description: 'CrawlerLane report object' },
  },
  required: ['report'],
  additionalProperties: false,
}

export const crawlerlaneExportJsonSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    report: { type: 'object', description: 'CrawlerLane report object' },
  },
  required: ['report'],
  additionalProperties: false,
}

export const opensourcelaneRepoAnalyzeSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    repo: { type: 'string', description: 'GitHub repo slug (e.g. hudy9x/namviek)' },
    repoUrl: { type: 'string', description: 'Full GitHub URL' },
    category: { type: 'string', description: 'Tool category' },
    metadata: { type: 'object', description: 'User-provided repo metadata (stars, contributors, etc.)' },
    readme: { type: 'string', description: 'README text' },
    requirements: { type: 'array', items: { type: 'string' }, description: 'Required features' },
  },
  additionalProperties: false,
}

export const opensourcelaneAlternativesFindSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    replace: { type: 'string', description: 'SaaS tool to replace (e.g. Jira, Notion)' },
    teamSize: { type: 'number', description: 'Team size' },
    budget: { type: 'string', enum: ['low', 'medium', 'high'] },
    deployment: { type: 'string', description: 'Deployment preference (self_hosted, docker, cloud)' },
    requiredFeatures: { type: 'array', items: { type: 'string' } },
    riskTolerance: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
  required: ['replace'],
  additionalProperties: false,
}

export const opensourcelaneMigrationPlanSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    from: { type: 'string', description: 'Current SaaS tool' },
    to: { type: 'string', description: 'Target open-source repo or tool' },
    teamSize: { type: 'number' },
    currentWorkflow: { type: 'array', items: { type: 'string' } },
    constraints: { type: 'object', description: 'Migration constraints (downtime, hosting)' },
  },
  required: ['from', 'to'],
  additionalProperties: false,
}

export const opensourcelaneCostEstimateSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    currentTool: { type: 'string' },
    teamSize: { type: 'number' },
    currentMonthlyCost: { type: 'number', description: 'Current monthly SaaS cost in USD' },
    hostingCost: { type: 'number' },
    maintenanceHoursPerMonth: { type: 'number' },
    hourlyRate: { type: 'number' },
  },
  required: ['currentTool', 'currentMonthlyCost'],
  additionalProperties: false,
}

export const opensourcelaneRiskScoreSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    repo: { type: 'string', description: 'GitHub repo slug' },
    metadata: { type: 'object' },
    requirements: { type: 'array', items: { type: 'string' } },
    readme: { type: 'string' },
  },
  required: ['repo'],
  additionalProperties: false,
}

export const opensourcelaneBriefGenerateSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    tool: { type: 'string' },
    repo: { type: 'string' },
    replace: { type: 'string' },
    teamSize: { type: 'number' },
    analysis: { type: 'object' },
  },
  required: ['tool', 'repo', 'replace'],
  additionalProperties: false,
}

export const opensourcelaneToolsCompareSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    tools: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          repo: { type: 'string' },
          metadata: { type: 'object' },
        },
        required: ['name', 'repo'],
      },
    },
    criteria: { type: 'array', items: { type: 'string' } },
  },
  required: ['tools'],
  additionalProperties: false,
}

export const opensourcelaneDeploymentPlanSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    tool: { type: 'string' },
    deployment: { type: 'string' },
    teamSize: { type: 'number' },
    environment: { type: 'string' },
  },
  required: ['tool'],
  additionalProperties: false,
}

export const opensourcelaneLicenseAuditSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    repo: { type: 'string' },
    license: { type: 'string' },
    intendedUse: { type: 'string' },
  },
  required: ['repo'],
  additionalProperties: false,
}

export const opensourcelaneExportMarkdownSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    data: { type: 'object', description: 'Analysis data to export' },
    title: { type: 'string' },
  },
  required: ['data'],
  additionalProperties: false,
}

export const opensourcelaneExportJsonSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    data: { type: 'object', description: 'Analysis data to export' },
    title: { type: 'string' },
  },
  required: ['data'],
  additionalProperties: false,
}

const forgecadDimensionsSchema = {
  type: 'object',
  properties: {
    length: { type: 'number' },
    width: { type: 'number' },
    height: { type: 'number' },
    thickness: { type: 'number' },
    unit: { type: 'string', enum: ['mm', 'cm', 'm', 'inch'] },
  },
}

export const forgecadDesignGenerateSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    projectType: { type: 'string', description: 'enclosure, bracket, mount, stand, box, tray, frame, etc.' },
    description: { type: 'string' },
    dimensions: forgecadDimensionsSchema,
    manufacturingMethod: { type: 'string' },
    material: { type: 'string' },
    requirements: { type: 'array', items: { type: 'string' } },
    constraints: { type: 'object' },
  },
  required: ['projectType'],
  additionalProperties: false,
}

export const forgecadOpenScadGenerateSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    projectType: { type: 'string' },
    dimensions: forgecadDimensionsSchema,
    features: { type: 'array', items: { type: 'string' } },
    manufacturingMethod: { type: 'string' },
    material: { type: 'string' },
  },
  required: ['projectType'],
  additionalProperties: false,
}

export const forgecadBomGenerateSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    projectType: { type: 'string' },
    parts: { type: 'array', items: { type: 'object' } },
    fasteners: { type: 'array', items: { type: 'string' } },
    material: { type: 'string' },
  },
  additionalProperties: false,
}

export const forgecadCutlistGenerateSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    projectType: { type: 'string' },
    dimensions: forgecadDimensionsSchema,
    material: { type: 'string' },
    members: { type: 'array', items: { type: 'object' } },
  },
  additionalProperties: false,
}

export const forgecadAssemblyPlanSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    projectType: { type: 'string' },
    parts: { type: 'array', items: { type: 'object' } },
    design: { type: 'object' },
  },
  additionalProperties: false,
}

export const forgecadPrintabilityCheckSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    manufacturingMethod: { type: 'string' },
    material: { type: 'string' },
    dimensions: forgecadDimensionsSchema,
    features: { type: 'array', items: { type: 'string' } },
    constraints: { type: 'object' },
  },
  additionalProperties: false,
}

export const forgecadManufacturabilityCheckSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    manufacturingMethod: { type: 'string' },
    material: { type: 'string' },
    dimensions: forgecadDimensionsSchema,
    features: { type: 'array', items: { type: 'string' } },
  },
  additionalProperties: false,
}

export const forgecadDesignReviewSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    design: { type: 'object' },
    requirements: { type: 'array', items: { type: 'string' } },
    manufacturingMethod: { type: 'string' },
  },
  additionalProperties: false,
}

export const forgecadMaterialEstimateSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    projectType: { type: 'string' },
    dimensions: forgecadDimensionsSchema,
    material: { type: 'string' },
    manufacturingMethod: { type: 'string' },
  },
  additionalProperties: false,
}

export const forgecadToolsDetectSchema: McpToolInputSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
}

export const forgecadRenderOpenScadSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    code: { type: 'string', description: 'OpenSCAD source code' },
    format: { type: 'string', enum: ['stl', 'png', 'off'] },
    filename: { type: 'string' },
  },
  required: ['code'],
  additionalProperties: false,
}

export const forgecadExportMarkdownSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    data: { type: 'object' },
    title: { type: 'string' },
  },
  required: ['data'],
  additionalProperties: false,
}

export const forgecadExportJsonSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    data: { type: 'object' },
    title: { type: 'string' },
  },
  required: ['data'],
  additionalProperties: false,
}

export const signallaneXAnalyzeSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    handle: { type: 'string', description: 'X (Twitter) handle to analyze (without @)' },
    period: { type: 'string', enum: ['7d', '14d', '30d', '90d'], description: 'Analysis period' },
  },
  required: ['handle'],
  additionalProperties: false,
}

export const signallaneXContentPlanSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    handle: { type: 'string', description: 'X (Twitter) handle (without @)' },
    goals: { type: 'array', items: { type: 'string' }, description: 'Content goals (e.g. engagement, followers, authority)' },
    topics: { type: 'array', items: { type: 'string' }, description: 'Preferred topics to cover' },
    tone: { type: 'string', description: 'Content tone (e.g. professional, casual, witty)' },
  },
  required: ['handle'],
  additionalProperties: false,
}

export const signallaneXPostDraftsSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    handle: { type: 'string', description: 'X (Twitter) handle (without @)' },
    topic: { type: 'string', description: 'Topic for the post drafts' },
    tone: { type: 'string', description: 'Desired tone (e.g. informative, humorous, provocative)' },
    count: { type: 'number', description: 'Number of drafts to generate (default 5)' },
  },
  required: ['handle'],
  additionalProperties: false,
}

export const signallaneXExperimentsSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    handle: { type: 'string', description: 'X (Twitter) handle (without @)' },
    goal: { type: 'string', description: 'Experiment goal (e.g. increase engagement, grow followers)' },
    focus: { type: 'array', items: { type: 'string' }, description: 'Focus areas for experiments' },
  },
  required: ['handle'],
  additionalProperties: false,
}

export const signallaneXReportSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    handle: { type: 'string', description: 'X (Twitter) handle (without @)' },
    period: { type: 'string', enum: ['7d', '14d', '30d', '90d'], description: 'Report period' },
    include: { type: 'array', items: { type: 'string' }, description: 'Sections to include (metrics, content, competitors, recommendations)' },
  },
  required: ['handle'],
  additionalProperties: false,
}

export const ugclaneStrategyGenerateSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    goal: { type: 'string', description: 'Content strategy goal (e.g. grow, engage, convert)' },
    niche: { type: 'string', description: 'Target niche or industry' },
    platform: { type: 'string', description: 'Target platform (youtube, tiktok, instagram, twitter, linkedin)' },
    constraints: { type: 'array', items: { type: 'string' }, description: 'Constraints to follow' },
  },
  required: ['goal'],
  additionalProperties: false,
}

export const ugclaneCompetitorAnalyzeSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    competitors: { type: 'array', items: { type: 'string' }, description: 'List of competitor identifiers (handles, channel names)' },
    niche: { type: 'string', description: 'Target niche' },
    depth: { type: 'string', enum: ['basic', 'detailed', 'deep'], description: 'Analysis depth' },
  },
  required: ['competitors'],
  additionalProperties: false,
}

export const ugclaneHooksGenerateSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    topic: { type: 'string', description: 'Content topic for hook generation' },
    platform: { type: 'string', description: 'Target platform' },
    count: { type: 'number', description: 'Number of hooks to generate (default 5)' },
    tone: { type: 'string', description: 'Desired tone' },
  },
  required: ['topic'],
  additionalProperties: false,
}

export const ugclaneScriptsGenerateSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    topic: { type: 'string', description: 'Script topic' },
    format: { type: 'string', enum: ['short', 'long', 'series'], description: 'Script format' },
    platform: { type: 'string', description: 'Target platform' },
    tone: { type: 'string', description: 'Desired tone' },
    cta: { type: 'string', description: 'Call to action' },
  },
  required: ['topic'],
  additionalProperties: false,
}

export const ugclaneAccountsPlanSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    platform: { type: 'string', description: 'Social platform' },
    goal: { type: 'string', description: 'Account goal' },
    metrics: { type: 'object', description: 'Current account metrics', additionalProperties: true },
    timeline: { type: 'string', description: 'Growth timeline (e.g. 30d, 90d)' },
  },
  required: ['platform', 'goal'],
  additionalProperties: false,
}

export const ugclaneCalendarGenerateSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    platform: { type: 'string', description: 'Target platform' },
    month: { type: 'string', description: 'Month for the calendar (YYYY-MM)' },
    goals: { type: 'array', items: { type: 'string' }, description: 'Content goals for the month' },
    themes: { type: 'array', items: { type: 'string' }, description: 'Content themes' },
    postFrequency: { type: 'string', description: 'Posting frequency (e.g. 3x week, daily)' },
  },
  required: ['platform'],
  additionalProperties: false,
}

export const ugclaneExperimentsGenerateSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    platform: { type: 'string', description: 'Target platform' },
    goal: { type: 'string', description: 'Experiment goal' },
    variables: { type: 'array', items: { type: 'string' }, description: 'Variables to test' },
    durationDays: { type: 'number', description: 'Experiment duration in days' },
  },
  required: ['platform', 'goal'],
  additionalProperties: false,
}

export const ugclaneReportGenerateSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    platform: { type: 'string', description: 'Target platform' },
    period: { type: 'string', description: 'Report period (e.g. 7d, 30d, 90d)' },
    metrics: { type: 'object', description: 'Metrics data for the report', additionalProperties: true },
    goal: { type: 'string', description: 'Content goal' },
  },
  required: ['platform', 'period', 'metrics'],
  additionalProperties: false,
}

export const ugclaneExportMarkdownSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    content: { type: 'object', description: 'Content data to export', additionalProperties: true },
    title: { type: 'string', description: 'Document title' },
    sections: { type: 'array', items: { type: 'string' }, description: 'Sections to include' },
  },
  required: ['content'],
  additionalProperties: false,
}

export const ugclaneExportJsonSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    content: { type: 'object', description: 'Content data to export', additionalProperties: true },
    format: { type: 'string', enum: ['pretty', 'compact'], description: 'JSON output format' },
  },
  required: ['content'],
  additionalProperties: false,
}

export const replylaneOpportunityScoreSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    tweetText: { type: 'string', description: 'Tweet text to evaluate for reply opportunity' },
    authorHandle: { type: 'string', description: 'Author handle without @' },
    authorFollowers: { type: 'number', description: 'Author follower count' },
    replyCount: { type: 'number', description: 'Current reply count on the tweet' },
    ageMinutes: { type: 'number', description: 'Minutes since tweet was posted' },
    yourFollowers: { type: 'number', description: 'Your follower count' },
    yourNiche: { type: 'string', description: 'Your niche for topic matching' },
    topicTags: { type: 'array', items: { type: 'string' } },
  },
  required: ['tweetText', 'authorHandle', 'authorFollowers'],
  additionalProperties: false,
}

export const replylaneTargetsRankSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    yourFollowers: { type: 'number', description: 'Your follower count' },
    yourNiche: { type: 'string', description: 'Your niche' },
    accounts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          handle: { type: 'string' },
          followers: { type: 'number' },
          niche: { type: 'string' },
          avgRepliesPerPost: { type: 'number' },
          postsPerWeek: { type: 'number' },
        },
        required: ['handle', 'followers'],
      },
    },
  },
  required: ['yourFollowers', 'accounts'],
  additionalProperties: false,
}

export const replylaneRepliesDraftSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    tweetText: { type: 'string', description: 'Tweet to reply to' },
    authorHandle: { type: 'string' },
    yourNiche: { type: 'string' },
    yourExperience: { type: 'string' },
    replyTypes: { type: 'array', items: { type: 'string' } },
    count: { type: 'number' },
    maxLength: { type: 'number' },
  },
  required: ['tweetText'],
  additionalProperties: false,
}

export const replylaneRepliesRiskSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    replyText: { type: 'string', description: 'Reply draft to check for deboost risk' },
    targetHandle: { type: 'string' },
    repliesLastHour: { type: 'number' },
    repliesToSameAccountToday: { type: 'number' },
    similarRepliesToday: { type: 'number' },
    containsLink: { type: 'boolean' },
  },
  required: ['replyText'],
  additionalProperties: false,
}

export const replylanePostsGrokCheckSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    postText: { type: 'string', description: 'Post or reply draft to check' },
    isReply: { type: 'boolean' },
    goal: { type: 'string' },
  },
  required: ['postText'],
  additionalProperties: false,
}

export const replylaneActivityAuditSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    entries: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['post', 'reply'] },
          handle: { type: 'string' },
          timestamp: { type: 'string' },
        },
        required: ['type'],
      },
    },
    periodDays: { type: 'number' },
    targetRepliesPerDay: { type: 'number' },
    targetPostsPerDay: { type: 'number' },
  },
  required: ['entries'],
  additionalProperties: false,
}

export const replylaneFeedsMigrateSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    communityName: { type: 'string' },
    niche: { type: 'string' },
    memberCount: { type: 'number' },
    currentTopics: { type: 'array', items: { type: 'string' } },
    goal: { type: 'string' },
  },
  additionalProperties: false,
}

export const replylaneExportMarkdownSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    data: { type: 'object' },
    title: { type: 'string' },
  },
  required: ['data'],
  additionalProperties: false,
}

export const replylaneExportJsonSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    data: { type: 'object' },
    title: { type: 'string' },
  },
  required: ['data'],
  additionalProperties: false,
}

export const skillsExportClaudeSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    skill: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Skill name' },
        skillMd: { type: 'string', description: 'Skill markdown content' },
        title: { type: 'string', description: 'Skill title' },
        description: { type: 'string', description: 'Skill description' },
        metadata: { type: 'object', description: 'Optional metadata' },
      },
      required: ['name', 'skillMd'],
      description: 'Skill object to export',
    },
  },
  required: ['skill'],
  additionalProperties: false,
}

export const tradiaHealthSchema: McpToolInputSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
}

export const tradiaAgentPlanSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    goal: { type: 'string', description: 'Trading goal (e.g. grow, preserve, income, learn)' },
    accountSize: { type: 'number', description: 'Account size in base currency' },
    riskTolerance: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Risk tolerance level' },
    markets: { type: 'array', items: { type: 'string' }, description: 'Markets to trade (e.g. forex, crypto, stocks)' },
    timeframe: { type: 'string', description: 'Trading timeframe (e.g. day, swing, position)' },
    experience: { type: 'string', description: 'Experience level (e.g. beginner, intermediate, advanced)' },
    constraints: { type: 'array', items: { type: 'string' }, description: 'Trading constraints' },
  },
  required: ['goal'],
  additionalProperties: false,
}

export const tradiaMarketAnalyzeSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    market: { type: 'string', description: 'Market or asset to analyze (e.g. BTC/USD, EUR/USD)' },
    timeframe: { type: 'string', description: 'Analysis timeframe' },
    indicators: { type: 'array', items: { type: 'string' }, description: 'Indicators to include' },
  },
  required: ['market'],
  additionalProperties: false,
}

export const tradiaSignalEvaluateSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    signal: { type: 'string', description: 'Trading signal or setup description' },
    market: { type: 'string', description: 'Market context' },
    confidence: { type: 'number', description: 'Signal confidence (0-100)' },
    timeframe: { type: 'string', description: 'Signal timeframe' },
  },
  required: ['signal'],
  additionalProperties: false,
}

export const tradiaRiskCheckSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    trade: { type: 'string', description: 'Trade setup description' },
    entryPrice: { type: 'number', description: 'Entry price' },
    stopLoss: { type: 'number', description: 'Stop loss price' },
    takeProfit: { type: 'number', description: 'Take profit price' },
    positionSize: { type: 'number', description: 'Position size in units' },
    accountSize: { type: 'number', description: 'Account size' },
    riskPercent: { type: 'number', description: 'Risk per trade as percentage of account' },
  },
  required: ['trade', 'entryPrice', 'stopLoss', 'accountSize'],
  additionalProperties: false,
}

export const tradiaTradeProposeSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    market: { type: 'string', description: 'Market or asset to trade' },
    direction: { type: 'string', enum: ['long', 'short'], description: 'Trade direction' },
    entryPrice: { type: 'number', description: 'Proposed entry price' },
    stopLoss: { type: 'number', description: 'Stop loss price' },
    takeProfit: { type: 'number', description: 'Take profit price' },
    positionSize: { type: 'number', description: 'Position size' },
    rationale: { type: 'string', description: 'Trade rationale' },
  },
  required: ['market', 'direction'],
  additionalProperties: false,
}

export const tradiaTradeJournalSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    tradeId: { type: 'string', description: 'Trade identifier' },
    market: { type: 'string', description: 'Market traded' },
    direction: { type: 'string', enum: ['long', 'short'], description: 'Trade direction' },
    entryPrice: { type: 'number', description: 'Entry price' },
    exitPrice: { type: 'number', description: 'Exit price' },
    quantity: { type: 'number', description: 'Quantity traded' },
    entryDate: { type: 'string', description: 'Entry date (ISO format)' },
    exitDate: { type: 'string', description: 'Exit date (ISO format)' },
    pnl: { type: 'number', description: 'Profit/loss in base currency' },
    pnlPercent: { type: 'number', description: 'Profit/loss percentage' },
    tags: { type: 'array', items: { type: 'string' }, description: 'Tags for categorization' },
    notes: { type: 'string', description: 'Trade notes and reflections' },
    emotion: { type: 'string', description: 'Emotional state during trade' },
    mistake: { type: 'string', description: 'Any mistake made' },
    lesson: { type: 'string', description: 'Lesson learned' },
  },
  additionalProperties: false,
}

export const tradiaPortfolioReportSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    assets: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          symbol: { type: 'string' },
          allocation: { type: 'number' },
          value: { type: 'number' },
        },
        required: ['symbol', 'allocation'],
      },
      description: 'Current portfolio holdings',
    },
    period: { type: 'string', description: 'Report period (e.g. 1m, 3m, 1y)' },
    benchmark: { type: 'string', description: 'Benchmark index' },
  },
  required: ['assets'],
  additionalProperties: false,
}

export const tradiaPerformanceAnalyzeSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    trades: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          pnl: { type: 'number' },
          pnlPercent: { type: 'number' },
          direction: { type: 'string' },
          market: { type: 'string' },
          date: { type: 'string' },
        },
        required: ['pnl'],
      },
      description: 'List of closed trades',
    },
    period: { type: 'string', description: 'Analysis period' },
    benchmark: { type: 'string', description: 'Benchmark for comparison' },
  },
  required: ['trades'],
  additionalProperties: false,
}

export const tradiaPublicUpdateGenerateSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    trades: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          market: { type: 'string' },
          direction: { type: 'string' },
          pnlPercent: { type: 'number' },
          date: { type: 'string' },
        },
        required: ['market', 'direction'],
      },
      description: 'Trades to include in update',
    },
    style: { type: 'string', enum: ['professional', 'casual', 'educational'], description: 'Update style' },
    platform: { type: 'string', description: 'Target platform (e.g. twitter, linkedin)' },
    includeMetrics: { type: 'boolean', description: 'Include performance metrics' },
    maxLength: { type: 'number', description: 'Maximum output length' },
  },
  required: ['trades'],
  additionalProperties: false,
}

export const tradiaBacktestSimulateSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    strategy: { type: 'string', description: 'Strategy description or rules' },
    market: { type: 'string', description: 'Market to backtest' },
    startDate: { type: 'string', description: 'Start date (ISO format)' },
    endDate: { type: 'string', description: 'End date (ISO format)' },
    initialCapital: { type: 'number', description: 'Initial capital' },
    parameters: { type: 'object', description: 'Strategy parameters' },
  },
  required: ['strategy', 'market'],
  additionalProperties: false,
}

export const tradiaAccountabilityCardSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    trades: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          pnl: { type: 'number' },
          pnlPercent: { type: 'number' },
          direction: { type: 'string' },
          market: { type: 'string' },
          followedPlan: { type: 'boolean' },
          mistake: { type: 'string' },
          lesson: { type: 'string' },
        },
        required: ['pnl'],
      },
      description: 'Trades for accountability review',
    },
    period: { type: 'string', description: 'Review period' },
    goals: { type: 'array', items: { type: 'string' }, description: 'Trading goals' },
  },
  required: ['trades'],
  additionalProperties: false,
}

export const tradiaExportMarkdownSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    data: { type: 'object', description: 'Tradia data to export' },
    title: { type: 'string', description: 'Document title' },
    sections: { type: 'array', items: { type: 'string' }, description: 'Sections to include' },
  },
  required: ['data'],
  additionalProperties: false,
}

export const tradiaExportJsonSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    data: { type: 'object', description: 'Tradia data to export' },
    format: { type: 'string', enum: ['pretty', 'compact'], description: 'JSON output format' },
  },
  required: ['data'],
  additionalProperties: false,
}

export const codraReviewSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    code: { type: 'string', description: 'Code to review' },
    language: { type: 'string', enum: ['cpp', 'javascript', 'typescript', 'python', 'java', 'go', 'rust'], description: 'Programming language' },
    rules: { type: 'array', items: { type: 'string', enum: ['no-raw-loops', 'off-by-one', 'modernize', 'memory-safety'] }, description: 'Rules to check' },
  },
  required: ['code'],
  additionalProperties: false,
}

export const doculaneExtractSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    documentUrl: { type: 'string', description: 'URL of the document to extract from (PDF, image, scan)' },
    prompt: { type: 'string', description: 'Natural language description of what to extract' },
    format: { type: 'string', enum: ['json', 'text', 'markdown'], description: 'Output format' },
    schema: { type: 'object', description: 'Optional schema defining expected fields and types' },
  },
  required: ['documentUrl', 'prompt'],
  additionalProperties: false,
}

export const calclaneHealthSchema: McpToolInputSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
}

export const calclanePricingSchema: McpToolInputSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
}

export const calclaneCapabilitiesSchema: McpToolInputSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
}

export const calclaneEvaluateSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    expression: {
      type: 'string',
      description: 'Math expression to evaluate, e.g. "2 + 3 * 4" or "sin(90)"',
    },
    mode: {
      type: 'string',
      enum: ['standard', 'scientific'],
      description: 'standard = left-to-right; scientific = operator precedence (default)',
    },
    angle: {
      type: 'string',
      enum: ['deg', 'rad', 'grad'],
      description: 'Angle unit for trig functions (default deg)',
    },
    fe: {
      type: 'boolean',
      description: 'Force scientific notation display',
    },
  },
  required: ['expression'],
  additionalProperties: false,
}

export const calclaneDispatchSchema: McpToolInputSchema = {
  type: 'object',
  properties: {
    commands: {
      type: 'array',
      description: 'Calculator engine commands (digit, binary, unary, equals, clear, const, ...)',
      items: { type: 'object' },
    },
    mode: {
      type: 'string',
      enum: ['standard', 'scientific'],
    },
    angle: {
      type: 'string',
      enum: ['deg', 'rad', 'grad'],
    },
  },
  required: ['commands'],
  additionalProperties: false,
}
