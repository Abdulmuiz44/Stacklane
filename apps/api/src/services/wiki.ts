import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs'

export interface WikiConfig {
  wikiDir: string
}

export interface WikiPage {
  title: string
  content: string
  source?: string
  created: Date
  updated: Date
}

export interface IngestResult {
  source: string
  pagesCreated: number
  linksCreated: number
  pages: string[]
}

export interface QueryResult {
  answer: string
  sources: Array<{ title: string; path: string; excerpt: string }>
}

export interface LintResult {
  orphans: string[]
  deadLinks: Array<{ page: string; link: string }>
  contradictions: Array<{ claim1: string; claim2: string; topic: string }>
  staleClaims: Array<{ page: string; claim: string; age: string }>
  stats: {
    pages: number
    links: number
    orphans: number
    deadLinks: number
    contradictions: number
  }
}

export class WikiService {
  private config: WikiConfig

  constructor(config: WikiConfig) {
    this.config = config
  }

  async init(): Promise<void> {
    const dirs = [
      this.config.wikiDir,
      join(this.config.wikiDir, 'domains'),
      join(this.config.wikiDir, 'sources'),
      join(this.config.wikiDir, 'links'),
    ]

    for (const dir of dirs) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
    }

    const indexPath = join(this.config.wikiDir, 'index.md')
    if (!existsSync(indexPath)) {
      writeFileSync(indexPath, this.generateIndexTemplate())
    }

    const hotPath = join(this.config.wikiDir, 'hot.md')
    if (!existsSync(hotPath)) {
      writeFileSync(hotPath, this.generateHotTemplate())
    }

    const linksPath = join(this.config.wikiDir, 'links.md')
    if (!existsSync(linksPath)) {
      writeFileSync(linksPath, '# Cross-References\n\n')
    }
  }

  async ingest(sourcePath: string, content?: string): Promise<IngestResult> {
    const sourceName = sourcePath.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'inline'
    const sourceDir = join(this.config.wikiDir, 'sources', sourceName)

    if (!existsSync(sourceDir)) {
      mkdirSync(sourceDir, { recursive: true })
    }
    mkdirSync(join(sourceDir, 'pages'), { recursive: true })

    const rawContent = content || (existsSync(sourcePath) ? readFileSync(sourcePath, 'utf-8') : '')
    const concepts = this.extractConcepts(rawContent)
    const pages: string[] = []

    for (const concept of concepts) {
      const pageName = this.slugify(concept.title)
      const pagePath = join(sourceDir, 'pages', `${pageName}.md`)
      const pageContent = this.generatePage(concept, sourceName)
      writeFileSync(pagePath, pageContent)
      pages.push(pageName)
    }

    const sourceIndex = this.generateSourceIndex(sourceName, sourcePath, concepts)
    writeFileSync(join(sourceDir, 'index.md'), sourceIndex)

    await this.updateIndex()
    await this.updateHotCache(sourceName, concepts.map(c => c.title))

    return {
      source: sourceName,
      pagesCreated: pages.length,
      linksCreated: concepts.reduce((acc, c) => acc + (c.links?.length || 0), 0),
      pages,
    }
  }

  async query(question: string): Promise<QueryResult> {
    const sources: QueryResult['sources'] = []
    const searchTerms = this.extractSearchTerms(question)

    const sourcesDir = join(this.config.wikiDir, 'sources')
    if (!existsSync(sourcesDir)) {
      return { answer: 'No knowledge base found. Run init first.', sources: [] }
    }

    const sourceDirs = readdirSync(sourcesDir)

    for (const sourceDir of sourceDirs) {
      const sourcePath = join(sourcesDir, sourceDir)
      if (!statSync(sourcePath).isDirectory()) continue

      const files = this.getAllMdFiles(sourcePath)
      for (const file of files) {
        const content = readFileSync(file, 'utf-8')
        const score = this.relevanceScore(content, searchTerms)

        if (score > 0) {
          const excerpt = this.extractExcerpt(content, searchTerms)
          sources.push({
            title: file.split('/').pop()?.replace('.md', '') || '',
            path: file.replace(this.config.wikiDir + '/', ''),
            excerpt,
          })
        }
      }
    }

    sources.sort((a, b) => b.excerpt.length - a.excerpt.length)
    const topSources = sources.slice(0, 5)

    const answer = topSources.length > 0
      ? `Found ${topSources.length} relevant sources:\n\n` +
        topSources.map(s => `- **${s.title}**: ${s.excerpt}`).join('\n')
      : `No results found for "${question}". Try ingesting some sources first.`

    return { answer, sources: topSources }
  }

  async lint(): Promise<LintResult> {
    const orphans: string[] = []
    const deadLinks: Array<{ page: string; link: string }> = []
    const contradictions: Array<{ claim1: string; claim2: string; topic: string }> = []
    const staleClaims: Array<{ page: string; claim: string; age: string }> = []

    const allPages = this.getAllMdFiles(this.config.wikiDir)
    const allLinks = new Set<string>()

    for (const page of allPages) {
      const content = readFileSync(page, 'utf-8')
      const links = content.match(/\[\[([^\]]+)\]\]/g) || []
      const relativePath = page.replace(this.config.wikiDir + '/', '')

      for (const link of links) {
        const target = link.replace(/\[\[|\]\]/g, '')
        allLinks.add(target)

        const targetPath = join(this.config.wikiDir, this.slugify(target) + '.md')
        if (!existsSync(targetPath)) {
          deadLinks.push({ page: relativePath, link: target })
        }
      }

      if (content.match(/(?:latest|current|as of)\s+[\w\s]*20\d{2}/i)) {
        staleClaims.push({
          page: relativePath,
          claim: content.match(/(?:latest|current|as of)[^.]+/i)?.[0] || '',
          age: 'possibly outdated',
        })
      }
    }

    for (const page of allPages) {
      const relativePath = page.replace(this.config.wikiDir + '/', '')
      const linkName = page.split('/').pop()?.replace('.md', '') || ''
      if (!allLinks.has(linkName) && !relativePath.includes('index.md') && !relativePath.includes('hot.md')) {
        orphans.push(relativePath)
      }
    }

    const stats = {
      pages: allPages.length,
      links: allLinks.size,
      orphans: orphans.length,
      deadLinks: deadLinks.length,
      contradictions: contradictions.length,
    }

    return { orphans, deadLinks, contradictions, staleClaims, stats }
  }

  async saveConversation(title: string, content: string): Promise<string> {
    const date = new Date().toISOString().split('T')[0]
    const sourceDir = join(this.config.wikiDir, 'sources', `conversation-${date}`)
    mkdirSync(sourceDir, { recursive: true })

    const pageContent = `---\ntitle: ${title}\ntype: conversation\ncreated: ${new Date().toISOString()}\n---\n\n${content}`

    writeFileSync(join(sourceDir, 'index.md'), pageContent)

    await this.updateIndex()
    return `conversation-${date}`
  }

  private extractConcepts(content: string): Array<{ title: string; summary: string; links?: string[] }> {
    const lines = content.split('\n').filter(l => l.trim())
    const concepts: Array<{ title: string; summary: string; links?: string[] }> = []

    for (const line of lines.slice(0, 20)) {
      const cleaned = line.replace(/^[-*]\s*/, '').trim()
      if (cleaned.length > 10 && cleaned.length < 200) {
        concepts.push({
          title: cleaned.substring(0, 100),
          summary: cleaned,
        })
      }
    }

    if (concepts.length === 0) {
      concepts.push({
        title: 'Extracted Content',
        summary: content.substring(0, 500),
      })
    }

    return concepts
  }

  private generatePage(concept: { title: string; summary: string; links?: string[] }, source: string): string {
    return `---\ntitle: ${concept.title}\nsource: ${source}\ncreated: ${new Date().toISOString()}\n---\n\n${concept.summary}`
  }

  private generateSourceIndex(source: string, path: string, concepts: Array<{ title: string }>): string {
    const links = concepts.map(c => `- [[${this.slugify(c.title)}]]`).join('\n')
    return `---\ntitle: ${source}\ntype: source\n---\n\n# ${source}\n\n**Source:** ${path}\n**Ingested:** ${new Date().toISOString()}\n\n## Pages\n${links}`
  }

  private generateIndexTemplate(): string {
    return `# Knowledge Base Index\n\nLast updated: ${new Date().toISOString()}\n\n## Sources\n- None yet\n\n## Statistics\n- Total sources: 0\n- Total pages: 0\n`
  }

  private generateHotTemplate(): string {
    return `# Hot Cache — Recent Context\n\nUpdated: ${new Date().toISOString()}\n\n## Last 7 Days\n- Wiki initialized\n`
  }

  private async updateIndex(): Promise<void> {
    const sourcesDir = join(this.config.wikiDir, 'sources')
    if (!existsSync(sourcesDir)) return

    const sources = readdirSync(sourcesDir).filter(s =>
      statSync(join(sourcesDir, s)).isDirectory()
    )

    const allPages = this.getAllMdFiles(this.config.wikiDir)
    const index = `# Knowledge Base Index\n\nLast updated: ${new Date().toISOString()}\n\n## Sources\n${sources.map(s => `- [[sources/${s}/index|${s}]]`).join('\n') || '- None'}\n\n## Statistics\n- Total sources: ${sources.length}\n- Total pages: ${allPages.length}\n`

    writeFileSync(join(this.config.wikiDir, 'index.md'), index)
  }

  private async updateHotCache(source: string, pages: string[]): Promise<void> {
    const hotPath = join(this.config.wikiDir, 'hot.md')
    const existing = existsSync(hotPath) ? readFileSync(hotPath, 'utf-8') : this.generateHotTemplate()

    const pagesStr = pages.slice(0, 3).join(', ')
    const updated = existing.replace(
      '## Last 7 Days',
      `## Last 7 Days\n- ${source}: ${pagesStr}`
    )

    writeFileSync(hotPath, updated)
  }

  private slugify(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }

  private extractSearchTerms(query: string): string[] {
    const stopWords = new Set(['what', 'about', 'tell', 'know', 'search', 'find', 'does', 'the', 'is', 'are'])
    return query.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w))
  }

  private relevanceScore(content: string, terms: string[]): number {
    const lower = content.toLowerCase()
    return terms.reduce((score, term) => score + (lower.includes(term) ? 1 : 0), 0)
  }

  private extractExcerpt(content: string, terms: string[]): string {
    const lines = content.split('\n').filter(l => l.trim())
    for (const line of lines) {
      const lower = line.toLowerCase()
      if (terms.some(t => lower.includes(t))) {
        return line.substring(0, 200)
      }
    }
    return lines[0]?.substring(0, 200) || ''
  }

  private getAllMdFiles(dir: string): string[] {
    const files: string[] = []
    if (!existsSync(dir)) return files

    const entries = readdirSync(dir)
    for (const entry of entries) {
      const fullPath = join(dir, entry)
      const stat = statSync(fullPath)

      if (stat.isDirectory() && !entry.startsWith('.')) {
        files.push(...this.getAllMdFiles(fullPath))
      } else if (entry.endsWith('.md')) {
        files.push(fullPath)
      }
    }

    return files
  }
}
