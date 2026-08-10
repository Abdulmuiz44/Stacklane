export const TALOCODE_CLOUD_PRICING = {
  creditUsdValue: 0.01,
  freeStartingCredits: 100,
  minimumTopUpCredits: 500,
  products: {
    agent_browser: {
      "browser.check": 5,
      "browser.screenshot": 8,
      "browser.evidence": 8,
      "browser.extract": 15,
      "browser.analyze": 25,
      "browser.trace_report": 15
    },
    tera_context: {
      "context.capture": 5,
      "context.summarize": 10
    },
    talocode_reach: {
      "web.read": 3,
      "search.query": 3,
      "github.read": 3,
      "rss.read": 2
    },
    cliploop: {
      "brief.generate": 15,
      "script.generate": 15,
      "video.render": 200,
      "campaign.create": 50,
      "campaign.package": 400
    },
    invoicelane: {
      "invoicelane.extract": 20,
      "invoicelane.receipt.extract": 20,
      "invoicelane.invoice.extract": 30,
      "invoicelane.validate": 10,
      "invoicelane.export.csv": 5
    },
    geolane: {
      "geolane.audit": 40,
      "geolane.crawlers": 15,
      "geolane.llms_txt": 20,
      "geolane.citation_readiness": 25,
      "geolane.compare": 50
    },
    searchlane: {
      "searchlane.query": 5,
      "searchlane.research": 30,
      "searchlane.news": 8
    },
    signallane: {
      "signallane.x.analyze": 30,
      "signallane.x.content_plan": 40,
      "signallane.x.post_drafts": 40,
      "signallane.x.experiments": 30,
      "signallane.x.report": 60
    },
    tradia: {
      "tradia.agent.plan": 40,
      "tradia.market.analyze": 30,
      "tradia.signal.evaluate": 30,
      "tradia.risk.check": 20,
      "tradia.trade.propose": 40,
      "tradia.trade.journal": 25,
      "tradia.portfolio.report": 50,
      "tradia.performance.analyze": 35,
      "tradia.public_update.generate": 30,
      "tradia.backtest.simulate": 60,
      "tradia.accountability.card": 25,
      "tradia.export.markdown": 5,
      "tradia.export.json": 5,
    },
    codra: {
      "repo.summary": 50,
      "explain": 20,
      "review": 40,
      "plan": 40,
      "codra.review": 20
    },
    worklane: {
      "workflow.small": 15,
      "workflow.large": 40
    },
    webdatalane: {
      "webdatalane.fetch": 5,
      "webdatalane.extract": 10,
      "webdatalane.markdown": 10,
      "webdatalane.metadata": 5,
      "webdatalane.links": 5,
      "webdatalane.structured": 20,
      "webdatalane.crawl.plan": 15,
      "webdatalane.screenshot": 50
    },
    skills: {
      "generate.github_profile": 80,
      "generate.github_repo": 100,
      "generate.docs": 100,
      "generate.text": 40,
      "generate.recording": 60,
      "export.cursor": 10,
      "export.claude": 10
    },
    crawlerlane: {
      "crawlerlane.logs.ingest": 5,
      "crawlerlane.bots.classify": 2,
      "crawlerlane.pages.analyze": 20,
      "crawlerlane.404.analyze": 20,
      "crawlerlane.ai_visibility.score": 30,
      "crawlerlane.report.generate": 40,
      "crawlerlane.sitemap.suggest": 20,
      "crawlerlane.robots.audit": 15,
      "crawlerlane.export.markdown": 5,
      "crawlerlane.export.json": 5,
    },
    forgecad: {
      "forgecad.design.generate": 60,
      "forgecad.openscad.generate": 40,
      "forgecad.bom.generate": 20,
      "forgecad.cutlist.generate": 20,
      "forgecad.assembly.plan": 25,
      "forgecad.printability.check": 25,
      "forgecad.manufacturability.check": 30,
      "forgecad.design.review": 40,
      "forgecad.material.estimate": 20,
      "forgecad.tools.detect": 5,
      "forgecad.render.openscad": 80,
      "forgecad.export.markdown": 5,
      "forgecad.export.json": 5,
    },
    opensourcelane: {
      "opensourcelane.repo.analyze": 25,
      "opensourcelane.alternatives.find": 30,
      "opensourcelane.migration.plan": 50,
      "opensourcelane.cost.estimate": 20,
      "opensourcelane.risk.score": 30,
      "opensourcelane.brief.generate": 40,
      "opensourcelane.tools.compare": 35,
      "opensourcelane.deployment.plan": 35,
      "opensourcelane.license.audit": 20,
      "opensourcelane.export.markdown": 5,
      "opensourcelane.export.json": 5,
    },
    ugclane: {
      "ugclane.strategy.generate": 30,
      "ugclane.competitor.analyze": 40,
      "ugclane.hooks.generate": 20,
      "ugclane.scripts.generate": 40,
      "ugclane.accounts.plan": 30,
      "ugclane.calendar.generate": 60,
      "ugclane.experiments.generate": 30,
      "ugclane.report.generate": 40,
      "ugclane.export.markdown": 5,
      "ugclane.export.json": 5
    },
    replylane: {
      "replylane.opportunity.score": 15,
      "replylane.targets.rank": 25,
      "replylane.replies.draft": 30,
      "replylane.replies.risk": 20,
      "replylane.posts.grok_check": 20,
      "replylane.activity.audit": 35,
      "replylane.feeds.migrate": 40,
      "replylane.export.markdown": 5,
      "replylane.export.json": 5,
    },
    flowlane: {
      "flowlane.workflow.create": 10,
      "flowlane.workflow.generate": 20,
      "flowlane.workflow.validate": 5,
      "flowlane.workflow.execute": 30,
      "flowlane.template.get": 2,
      "flowlane.export.claude": 10,
      "flowlane.export.cursor": 10,
      "flowlane.export.codra": 10
    },
    maillane: {
      "maillane.send.text": 2,
      "maillane.send.html": 3,
      "maillane.send.attachment": 5,
      "maillane.account.connect": 0,
      "maillane.account.list": 0,
      "maillane.stats.get": 0
    },
    doculane: {
      "doculane.read": 5,
      "doculane.write": 5,
      "doculane.info": 2,
      "doculane.extract": 30
    },
    calclane: {
      "calclane.evaluate": 1,
      "calclane.dispatch": 1
    },
    reliabilitylane: {
      "reliabilitylane.patterns": 1,
      "reliabilitylane.retry": 1,
      "reliabilitylane.verify": 1,
      "reliabilitylane.incident": 2,
      "reliabilitylane.antipatterns": 0
    },
    verifylane: {
      "verifylane.secrets": 3,
      "verifylane.security": 5,
      "verifylane.quality": 3,
      "verifylane.code": 8,
      "verifylane.diff": 8,
      "verifylane.agent-output": 5
    },
    policylane: {
      "policylane.check": 2,
      "policylane.redact": 1
    },
    gatelane: {
      "gatelane.check": 2,
      "gatelane.guard": 3
    },
    spendcaps: {
      "spendcaps.check": 1
    }
  }
} as const

export function getPricingForAction(product: string, action: string): number | null {
  const productPricing = (TALOCODE_CLOUD_PRICING.products as Record<string, Record<string, number>>)[product]
  if (!productPricing) return null
  return productPricing[action] ?? null
}

export function listAllPricing() {
  return TALOCODE_CLOUD_PRICING
}
