import { TeraClient } from './tera'
import { AgentBrowserClient } from './agent-browser'
import { ClipLoopClient } from './cliploop'
import { CodraClient } from './codra'
import { SkillsClient } from './skills'
import { InvoiceLaneClient } from './invoicelane'
import { GeoLaneClient } from './geolane'
import { SearchLaneClient } from './searchlane'
import { CalcLaneClient } from './calclane'
import { WebDataLaneClient } from './webdatalane'
import { SignalLaneClient } from './signallane'
import { UGCLaneClient } from './ugclane'
import { CrawlerLaneClient } from './crawlerlane'
import { OpenSourceLaneClient } from './opensourcelane'
import { ForgeCADClient } from './forgecad'
import { ReplyLaneClient } from './replylane'
import { TradiaClient } from './tradia'
import { request } from './request'
import {
  WorkLaneClientPlaceholder,
} from './placeholders'

export interface TalocodeOptions {
  apiKey?: string
  baseUrl?: string
  timeoutMs?: number
  headers?: Record<string, string>
}

const DEFAULT_BASE_URL = 'https://api.talocode.site'
const DEFAULT_TIMEOUT_MS = 30000

export class TalocodeApiClient {
  public tera: TeraClient
  public agentBrowser: AgentBrowserClient
  public cliploop: ClipLoopClient
  public codra: CodraClient
  public skills: SkillsClient
  public invoicelane: InvoiceLaneClient
  public geolane: GeoLaneClient
  public searchlane: SearchLaneClient
  public calclane: CalcLaneClient
  public webdatalane: WebDataLaneClient
  public ugclane: UGCLaneClient
  public crawlerlane: CrawlerLaneClient
  public opensourcelane: OpenSourceLaneClient
  public forgecad: ForgeCADClient
  public replylane: ReplyLaneClient
  public tradia: TradiaClient
  public worklane: WorkLaneClientPlaceholder
  public baseUrl: string
  public apiKey: string | undefined
  public timeoutMs: number
  private _signallane?: SignalLaneClient

  constructor(options: TalocodeOptions = {}) {
    this.apiKey =
      options.apiKey ??
      (typeof process !== 'undefined' ? process.env.TALOCODE_API_KEY : undefined)
    this.baseUrl =
      options.baseUrl ??
      (typeof process !== 'undefined' ? process.env.TALOCODE_BASE_URL : undefined) ??
      DEFAULT_BASE_URL
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

    this.tera = new TeraClient(this.baseUrl, this.apiKey, this.timeoutMs)
    this.agentBrowser = new AgentBrowserClient(this.baseUrl, this.apiKey, this.timeoutMs)
    this.cliploop = new ClipLoopClient(this.baseUrl, this.apiKey, this.timeoutMs)
    this.codra = new CodraClient(this.baseUrl, this.apiKey, this.timeoutMs)
    this.skills = new SkillsClient(this.baseUrl, this.apiKey, this.timeoutMs)
    this.invoicelane = new InvoiceLaneClient(this)
    this.geolane = new GeoLaneClient(this)
    this.searchlane = new SearchLaneClient(this)
    this.calclane = new CalcLaneClient(this)
    this.webdatalane = new WebDataLaneClient(this)
    this.ugclane = new UGCLaneClient(this)
    this.crawlerlane = new CrawlerLaneClient(this)
    this.opensourcelane = new OpenSourceLaneClient(this)
    this.forgecad = new ForgeCADClient(this)
    this.replylane = new ReplyLaneClient(this)
    this.tradia = new TradiaClient(this.baseUrl, this.apiKey, this.timeoutMs)
    this.worklane = new WorkLaneClientPlaceholder()
  }

  get signallane(): SignalLaneClient {
    if (!this._signallane) {
      this._signallane = new SignalLaneClient(this)
    }
    return this._signallane
  }

  async request(path: string, options: { method?: string; body?: unknown; headers?: Record<string, string>; timeoutMs?: number } = {}): Promise<unknown> {
    return request(this.baseUrl, path, this.apiKey, {
      ...options,
      timeoutMs: options.timeoutMs ?? this.timeoutMs,
    })
  }
}

export { TalocodeApiClient as Talocode }
