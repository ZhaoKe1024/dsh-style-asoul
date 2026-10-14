/**
 * dsh-style-asoul — A-SOUL 外观风格插件（client 半边）
 *
 * 背景皮肤引擎按社区已验证方案（dsh-dream-skin）重构：
 *  1. 壁纸 = 真实 div（position:fixed; z-index:-1，prepend 到 body），
 *     图片下方垫一层不透明底色（帧被洗透后不露白）；
 *  2. 底色洗涤 = theme.overrideTokens 覆盖 --dsw-alias-bg-base 与
 *     --dsw-specific-sidebar-fill（明暗双值），叠加层由官方 presenter
 *     写入 body 内联 token —— 与社区插件同一条生效链路；
 *  3. Windows 桌面壳专属结构（html[data-windows-titlebar]、caption 条、
 *     dshDesktopSidebarSurface）用结构选择器 CSS 处理，不用哈希类名；
 *  4. 主题服务走 inject: ['slots', 'theme'] 硬依赖（ctx.theme），不做弱探测。
 *
 * 依赖：inject ['slots', 'theme']。
 */
const PKG = 'dsh-style-asoul'
const API = `/${PKG}/api`
const OVERRIDE_ACCENT = `${PKG}/accent`
const OVERRIDE_WASH = `${PKG}/wash`
const WASH_ATTR = 'data-dsh-style-asoul-wash'
const SKIN_CSS_ID = 'dsh-style-asoul-skin'
const MAX_IMAGE_BYTES = 8 * 1024 * 1024

export const inject = ['slots', 'theme']

/* ── 最小 React 面板（模块系统提供 require("react")，无编译期依赖） ── */
declare const require: (spec: string) => any
interface ReactLike {
  createElement(type: string, props?: Record<string, unknown> | null, ...children: unknown[]): unknown
  useRef<T>(initial: T): { current: T }
  useEffect(fn: () => void | (() => void), deps?: readonly unknown[]): void
}
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const React: ReactLike = require('react')

/* ── 服务面类型（theme 为硬依赖，编译期零依赖） ── */
interface ThemeService {
  getTheme(): {
    preference?: string
    active?: { colorScheme?: 'light' | 'dark' }
  }
  setTheme(id: string): void
  overrideTokens(source: string, tokens: Record<string, { light: string; dark: string }>): () => void
}

interface SlotsLike {
  register(options: {
    name: string
    id?: string
    order?: number
    label?: string | (() => string)
    priority?: number
  }, component: unknown): () => void
  inject(key: string, callback: () => (() => void) | void): unknown
}

interface CtxLike {
  slots: SlotsLike
  theme: ThemeService
  get(name: string): unknown
  effect(fn: () => void, label?: string): unknown
  on?(name: string, listener: (snapshot: { preference?: string }) => void): unknown
}

/* ── 配置类型（与 host 保持一致） ── */
type AsoulMode = 'light' | 'dark' | 'system'
type AsoulAccent = 'default' | 'coffee' | 'green' | 'bella' | 'diana' | 'eileen'
const ACCENT_IDS: readonly AsoulAccent[] = ['default', 'coffee', 'green', 'bella', 'diana', 'eileen']

interface AsoulBg {
  enabled: boolean
  image: string
  alpha: number
  /** 底色不透明度（洗涤强度，0.05~1；越小壁纸越透出） */
  baseOpacity: number
}

interface AsoulConfig {
  mode: AsoulMode
  accent: AsoulAccent
  bg: AsoulBg
  originalPreference?: string
}

const DEFAULT_CONFIG: AsoulConfig = {
  mode: 'light',
  accent: 'default',
  bg: { enabled: true, image: '__default__', alpha: 0.3, baseOpacity: 0.12 },
}

/* ── 主色调调色板（token → {light, dark}） ── */
type AccentPalette = Record<string, { light: string; dark: string }>

const ACCENT_PALETTES: Record<Exclude<AsoulAccent, 'default'>, AccentPalette> = {
  coffee: {
    '--dsw-alias-state-business-primary': { light: 'rgb(146, 94, 55)', dark: 'rgb(206, 158, 113)' },
    '--dsw-alias-state-business-tertiary': { light: 'rgb(243, 232, 220)', dark: 'rgb(74, 58, 45)' },
    '--dsw-alias-button-info-fill': { light: 'rgb(146, 94, 55)', dark: 'rgb(206, 158, 113)' },
    '--dsw-alias-button-info-hover': { light: 'rgb(171, 117, 75)', dark: 'rgb(222, 182, 142)' },
    '--dsw-alias-brand-primary-new-colorprimary-new-color': { light: 'rgb(146, 94, 55)', dark: 'rgb(206, 158, 113)' },
    '--dsw-alias-label-primary-bluish': { light: 'rgb(146, 94, 55)', dark: 'rgb(206, 158, 113)' },
    '--dsw-specific-sidebar-nav-item-active-accent': { light: 'rgb(243, 232, 220)', dark: 'rgb(74, 58, 45)' },
    '--dsw-specific-bubble': { light: 'rgb(247, 240, 232)', dark: 'rgb(52, 44, 38)' },
    '--dsw-specific-bubble-highlight': { light: 'rgb(240, 226, 209)', dark: 'rgb(74, 58, 45)' },
  },
  green: {
    '--dsw-alias-state-business-primary': { light: 'rgb(74, 124, 89)', dark: 'rgb(143, 203, 166)' },
    '--dsw-alias-state-business-tertiary': { light: 'rgb(228, 240, 232)', dark: 'rgb(41, 66, 52)' },
    '--dsw-alias-button-info-fill': { light: 'rgb(74, 124, 89)', dark: 'rgb(143, 203, 166)' },
    '--dsw-alias-button-info-hover': { light: 'rgb(93, 144, 108)', dark: 'rgb(165, 217, 185)' },
    '--dsw-alias-brand-primary-new-colorprimary-new-color': { light: 'rgb(74, 124, 89)', dark: 'rgb(143, 203, 166)' },
    '--dsw-alias-label-primary-bluish': { light: 'rgb(74, 124, 89)', dark: 'rgb(143, 203, 166)' },
    '--dsw-specific-sidebar-nav-item-active-accent': { light: 'rgb(228, 240, 232)', dark: 'rgb(41, 66, 52)' },
    '--dsw-specific-bubble': { light: 'rgb(234, 243, 237)', dark: 'rgb(38, 55, 46)' },
    '--dsw-specific-bubble-highlight': { light: 'rgb(217, 233, 223)', dark: 'rgb(41, 66, 52)' },
  },
  /* 贝拉 #BD7D74 —— 灰调玫瑰 */
  bella: {
    '--dsw-alias-state-business-primary': { light: 'rgb(189, 125, 116)', dark: 'rgb(222, 164, 157)' },
    '--dsw-alias-state-business-tertiary': { light: 'rgb(247, 236, 234)', dark: 'rgb(84, 60, 56)' },
    '--dsw-alias-button-info-fill': { light: 'rgb(189, 125, 116)', dark: 'rgb(222, 164, 157)' },
    '--dsw-alias-button-info-hover': { light: 'rgb(207, 152, 145)', dark: 'rgb(235, 190, 185)' },
    '--dsw-alias-brand-primary-new-colorprimary-new-color': { light: 'rgb(189, 125, 116)', dark: 'rgb(222, 164, 157)' },
    '--dsw-alias-label-primary-bluish': { light: 'rgb(189, 125, 116)', dark: 'rgb(222, 164, 157)' },
    '--dsw-specific-sidebar-nav-item-active-accent': { light: 'rgb(247, 236, 234)', dark: 'rgb(84, 60, 56)' },
    '--dsw-specific-bubble': { light: 'rgb(249, 240, 239)', dark: 'rgb(64, 48, 46)' },
    '--dsw-specific-bubble-highlight': { light: 'rgb(244, 229, 227)', dark: 'rgb(84, 60, 56)' },
  },
  /* 嘉然 #E799B0 —— 柔粉 */
  diana: {
    '--dsw-alias-state-business-primary': { light: 'rgb(231, 153, 176)', dark: 'rgb(242, 175, 194)' },
    '--dsw-alias-state-business-tertiary': { light: 'rgb(252, 239, 244)', dark: 'rgb(96, 60, 73)' },
    '--dsw-alias-button-info-fill': { light: 'rgb(231, 153, 176)', dark: 'rgb(242, 175, 194)' },
    '--dsw-alias-button-info-hover': { light: 'rgb(240, 178, 195)', dark: 'rgb(248, 200, 213)' },
    '--dsw-alias-brand-primary-new-colorprimary-new-color': { light: 'rgb(231, 153, 176)', dark: 'rgb(242, 175, 194)' },
    '--dsw-alias-label-primary-bluish': { light: 'rgb(214, 122, 150)', dark: 'rgb(242, 175, 194)' },
    '--dsw-specific-sidebar-nav-item-active-accent': { light: 'rgb(252, 239, 244)', dark: 'rgb(96, 60, 73)' },
    '--dsw-specific-bubble': { light: 'rgb(253, 244, 247)', dark: 'rgb(72, 50, 58)' },
    '--dsw-specific-bubble-highlight': { light: 'rgb(250, 233, 239)', dark: 'rgb(96, 60, 73)' },
  },
  /* 乃琳 #576690 —— 靛蓝 */
  eileen: {
    '--dsw-alias-state-business-primary': { light: 'rgb(87, 102, 144)', dark: 'rgb(150, 163, 204)' },
    '--dsw-alias-state-business-tertiary': { light: 'rgb(234, 237, 245)', dark: 'rgb(52, 59, 86)' },
    '--dsw-alias-button-info-fill': { light: 'rgb(87, 102, 144)', dark: 'rgb(150, 163, 204)' },
    '--dsw-alias-button-info-hover': { light: 'rgb(112, 127, 168)', dark: 'rgb(172, 184, 219)' },
    '--dsw-alias-brand-primary-new-colorprimary-new-color': { light: 'rgb(87, 102, 144)', dark: 'rgb(150, 163, 204)' },
    '--dsw-alias-label-primary-bluish': { light: 'rgb(87, 102, 144)', dark: 'rgb(150, 163, 204)' },
    '--dsw-specific-sidebar-nav-item-active-accent': { light: 'rgb(234, 237, 245)', dark: 'rgb(52, 59, 86)' },
    '--dsw-specific-bubble': { light: 'rgb(239, 241, 247)', dark: 'rgb(43, 48, 66)' },
    '--dsw-specific-bubble-highlight': { light: 'rgb(228, 232, 242)', dark: 'rgb(52, 59, 86)' },
  },
}

/* ── 引擎状态 ── */
let cfg: AsoulConfig | null = null
let lastPreference = 'system'
/* 默认壁纸由构建脚本嵌入 bundle（dsh-app:// 自定义协议页面经 API 拉大图不可靠） */
const EMBEDDED_DEFAULT_IMAGE = '__DSH_ASOUL_EMBED__'
let defaultDataUrl = EMBEDDED_DEFAULT_IMAGE.startsWith('data:image/') ? EMBEDDED_DEFAULT_IMAGE : ''
let accentDispose: (() => void) | null = null
let washDispose: (() => void) | null = null
let wallpaperEl: HTMLDivElement | null = null
let applyingBg = false

/* 安装版官方明暗底色（design-platform.css 的 bg-base / sidebar-fill） */
const BASE_LIGHT = 'rgb(255, 255, 255)'
const BASE_DARK = 'rgb(21, 21, 23)'
const SIDE_LIGHT = 'rgb(249, 250, 251)'
const SIDE_DARK = 'rgb(21, 21, 22)'

/* ── 面板 UI 引用（sync 时刷新） ── */
let modeBtns: Record<string, HTMLButtonElement> = {}
let accentBtns: Record<string, HTMLButtonElement> = {}
let bgToggle: HTMLInputElement | null = null
let alphaInput: HTMLInputElement | null = null
let alphaValue: HTMLElement | null = null
let baseInput: HTMLInputElement | null = null
let baseValue: HTMLElement | null = null
let previewImg: HTMLImageElement | null = null
let previewNone: HTMLElement | null = null
let statusLine: HTMLElement | null = null
let statusTimer = 0

/* ── 工具 ── */
function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (text !== undefined) node.textContent = text
  return node
}

function clamp(n: number, lo: number, hi: number): number {
  if (typeof n !== 'number' || Number.isNaN(n)) return lo
  return Math.min(hi, Math.max(lo, n))
}

function toRgba(rgb: string, alpha: number): string {
  const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(rgb)
  if (!m) return rgb
  return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${clamp(alpha, 0, 1)})`
}

function cssUrl(url: string): string {
  return url.replace(/["'\\\n\r]/g, '')
}

function normalizeLocal(raw: unknown): AsoulConfig {
  const input = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const bgIn = (typeof input.bg === 'object' && input.bg !== null ? input.bg : {}) as Record<string, unknown>
  const mode: AsoulMode = input.mode === 'dark' || input.mode === 'system' || input.mode === 'light' ? input.mode : DEFAULT_CONFIG.mode
  const accent: AsoulAccent = ACCENT_IDS.includes(input.accent as AsoulAccent) ? input.accent as AsoulAccent : DEFAULT_CONFIG.accent
  const out: AsoulConfig = {
    mode,
    accent,
    bg: {
      enabled: typeof bgIn.enabled === 'boolean' ? bgIn.enabled : DEFAULT_CONFIG.bg.enabled,
      image: typeof bgIn.image === 'string' ? bgIn.image : DEFAULT_CONFIG.bg.image,
      alpha: clamp(Number(bgIn.alpha), 0, 1),
      baseOpacity: clamp(Number(bgIn.baseOpacity), 0.05, 1),
    },
  }
  const orig = input.originalPreference
  if (orig === 'light' || orig === 'dark' || orig === 'system') out.originalPreference = orig
  return out
}

interface ApiResult {
  ok: boolean
  config?: unknown
  dataUrl?: string
  error?: string
}

async function apiCall(method: string, args?: unknown): Promise<ApiResult | null> {
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ method, args: args ?? {} }),
    })
    return (await res.json()) as ApiResult
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

function status(text: string, isErr = false): void {
  if (!statusLine) return
  const line = statusLine
  line.textContent = text
  line.classList.toggle('err', isErr)
  window.clearTimeout(statusTimer)
  if (!isErr) {
    statusTimer = window.setTimeout(() => {
      line.textContent = ''
    }, 2600)
  }
}

/* ── 背景皮肤引擎（社区方案：真实 div + 底垫色 + token 洗涤 + wash 标记） ── */
function currentScheme(): 'light' | 'dark' {
  return themeActive() === 'dark' ? 'dark' : 'light'
}

function themeActive(): string | undefined {
  return ctxTheme()?.getTheme()?.active?.colorScheme
}

function ctxTheme(): ThemeService | null {
  // 由模块级 themeService 引用（apply 时注入）
  return themeServiceRef
}

let themeServiceRef: ThemeService | null = null

function resolveImageUrl(): string {
  const c = cfg
  if (!c || !c.bg.enabled) return ''
  if (c.bg.image === '__default__') return defaultDataUrl
  return c.bg.image.startsWith('data:image/') ? c.bg.image : ''
}

function ensureWallpaperEl(): HTMLDivElement {
  if (wallpaperEl === null || !document.body.contains(wallpaperEl)) {
    wallpaperEl = document.createElement('div')
    wallpaperEl.setAttribute('data-dsh-style-asoul-wallpaper', '1')
    wallpaperEl.style.cssText = 'position:fixed;inset:0;z-index:-1;pointer-events:none;background-size:cover;background-position:center;background-repeat:no-repeat;'
    document.body.prepend(wallpaperEl)
  }
  return wallpaperEl
}

function setWashAttr(active: boolean): void {
  const root = document.documentElement
  if (active) root.setAttribute(WASH_ATTR, '1')
  else root.removeAttribute(WASH_ATTR)
}

/** 应用/拆除背景皮肤（不依赖 React；重新进入有防重入保护）。 */
function applyBackground(): void {
  if (applyingBg) return
  applyingBg = true
  try {
    const c = cfg
    if (!c || !c.bg.enabled) {
      teardownBackground()
      return
    }
    const url = resolveImageUrl()
    const wall = ensureWallpaperEl()
    const scheme = currentScheme()
    // 不透明底垫：帧被洗透后，图片解码中/缺失时不会露出白色画布
    wall.style.backgroundColor = scheme === 'dark' ? BASE_DARK : BASE_LIGHT
    wall.style.backgroundImage = url ? `url("${cssUrl(url)}")` : 'none'
    wall.style.opacity = String(clamp(c.bg.alpha, 0, 1))
    // token 洗涤（社区同链路：官方 presenter 会把该层写到 body 内联 token）
    const wash = clamp(c.bg.baseOpacity, 0.05, 1)
    const sideWash = Math.min(1, wash + 0.12)
    if (washDispose) {
      washDispose()
      washDispose = null
    }
    if (themeServiceRef) {
      washDispose = themeServiceRef.overrideTokens(OVERRIDE_WASH, {
        '--dsw-alias-bg-base': { light: toRgba(BASE_LIGHT, wash), dark: toRgba(BASE_DARK, wash) },
        '--dsw-specific-sidebar-fill': { light: toRgba(SIDE_LIGHT, sideWash), dark: toRgba(SIDE_DARK, sideWash) },
      })
    }
    setWashAttr(true)
  } finally {
    applyingBg = false
  }
}

function teardownBackground(): void {
  if (wallpaperEl !== null) {
    wallpaperEl.remove()
    wallpaperEl = null
  }
  if (washDispose) {
    washDispose()
    washDispose = null
  }
  setWashAttr(false)
}

/** 将当前配置实时应用到界面（不落盘）。 */
function applyVisual(): void {
  const c = cfg
  if (!c) return
  if (themeServiceRef) {
    accentDispose?.()
    accentDispose = null
    if (c.accent !== 'default') {
      accentDispose = themeServiceRef.overrideTokens(OVERRIDE_ACCENT, ACCENT_PALETTES[c.accent])
    }
    themeServiceRef.setTheme(c.mode)
  }
  applyBackground()
  sync()
}

async function ensureDefaultImage(): Promise<void> {
  if (defaultDataUrl) return
  const res = await apiCall('get-default-image')
  if (res?.ok && typeof res.dataUrl === 'string' && res.dataUrl.startsWith('data:image/')) {
    defaultDataUrl = res.dataUrl
    applyBackground()
    sync()
    reportToHost()
  }
}

/** 页面自诊断：把实时计算样式快照上报 host（report.json），便于定位渲染断点。 */
let lastReportAt = 0
function reportToHost(): void {
  const now = Date.now()
  if (now - lastReportAt < 800) return
  lastReportAt = now
  void (async () => {
    try {
      const body = document.body
      const cs = getComputedStyle(body)
      const html = document.documentElement
      const frame = document.querySelector('div:has(> [data-shell-overlay])') as HTMLElement | null
      const wall = wallpaperEl
      await apiCall('client-report', {
        report: {
          at: new Date().toISOString(),
          url: location.href,
          preference: themeServiceRef ? themeServiceRef.getTheme().preference : null,
          activeScheme: themeActive(),
          cfg,
          washAttr: html.getAttribute(WASH_ATTR),
          wallExists: wall !== null && document.body.contains(wall),
          wallBgImage: wall ? wall.style.backgroundImage.slice(0, 64) : 'no-wall',
          wallOpacity: wall ? wall.style.opacity : 'no-wall',
          wallBgColor: wall ? wall.style.backgroundColor : 'no-wall',
          bodyBgBaseVar: cs.getPropertyValue('--dsw-alias-bg-base'),
          bodyBgColor: cs.backgroundColor,
          frameBg: frame ? getComputedStyle(frame).backgroundColor : 'no-frame-el',
          defaultImageLoaded: defaultDataUrl.length > 0,
        },
      })
    } catch { /* 诊断失败静默 */ }
  })()
}

async function applyAndSave(): Promise<void> {
  const c = cfg
  if (!c) return
  applyVisual()
  if (c.bg.enabled && c.bg.image === '__default__') await ensureDefaultImage()
  const res = await apiCall('set-config', { config: c })
  if (res && !res.ok) {
    status(`保存失败：${res.error ?? '未知错误'}`, true)
  } else {
    status('已保存')
  }
  sync()
  reportToHost()
}

/** 一键还原：恢复插件启用前的主题偏好，清除主色调/背景，并以中性配置落盘。 */
async function doReset(): Promise<void> {
  const c = cfg
  if (!c) return
  if (!window.confirm('确定还原到插件启用前的系统原始设置吗？主色调、背景图与自定义配置都会被清除。')) return
  const pref = themeServiceRef ? themeServiceRef.getTheme().preference : undefined
  const orig: AsoulMode = (c.originalPreference === 'light' || c.originalPreference === 'dark' || c.originalPreference === 'system')
    ? c.originalPreference
    : (pref === 'light' || pref === 'dark' || pref === 'system' ? pref : 'system')
  const neutral: AsoulConfig = {
    mode: orig,
    accent: 'default',
    bg: { enabled: false, image: '__default__', alpha: 0.3, baseOpacity: 0.12 },
    originalPreference: orig,
  }
  const res = await apiCall('set-config', { config: neutral })
  if (!res || !res.ok) {
    status(`还原失败：${res?.error ?? '未知错误'}`, true)
    return
  }
  cfg = neutral
  applyVisual()
  status('已还原到系统原始设置')
}

/* ── 面板 UI ── */
function sliderRow(parent: HTMLElement, label: string, min: number, max: number, onInput: (v: number) => void, onChange: () => void): { input: HTMLInputElement; value: HTMLElement } {
  const row = el('div', 'asoul-row')
  row.appendChild(el('span', 'asoul-row-label', label))
  const input = el('input') as HTMLInputElement
  input.type = 'range'
  input.min = String(min)
  input.max = String(max)
  input.step = '1'
  input.className = 'asoul-range'
  input.addEventListener('input', () => onInput(Number(input.value)))
  input.addEventListener('change', () => onChange())
  const value = el('span', 'asoul-row-value', '')
  row.appendChild(input)
  row.appendChild(value)
  parent.appendChild(row)
  return { input, value }
}

function sync(): void {
  const c = cfg
  if (!c) return
  for (const [id, btn] of Object.entries(modeBtns)) btn.classList.toggle('on', lastPreference === id)
  for (const [id, btn] of Object.entries(accentBtns)) btn.classList.toggle('on', c.accent === id)
  if (bgToggle) bgToggle.checked = c.bg.enabled
  if (alphaInput) alphaInput.value = String(Math.round(c.bg.alpha * 100))
  if (alphaValue) alphaValue.textContent = `${Math.round(c.bg.alpha * 100)}%`
  if (baseInput) baseInput.value = String(Math.round(c.bg.baseOpacity * 100))
  if (baseValue) baseValue.textContent = `${Math.round(c.bg.baseOpacity * 100)}%`
  const url = resolveImageUrl()
  if (url && previewImg) {
    previewImg.src = url
    previewImg.style.display = 'block'
    if (previewNone) previewNone.style.display = 'none'
  } else {
    if (previewImg) previewImg.style.display = 'none'
    if (previewNone) previewNone.style.display = 'flex'
  }
}

function mountPanel(container: HTMLElement): () => void {
  const style = document.createElement('style')
  style.textContent = PANEL_CSS
  container.appendChild(style)

  const page = el('div', 'asoul-page')
  page.appendChild(el('h2', 'asoul-title', '外观风格'))
  page.appendChild(el('p', 'asoul-sub', 'dsh-style-asoul v0.1 · 亮色/夜间模式 · 咖啡色/豆沙绿主色调 · 自定义背景图（默认嘉然壁纸）'))

  /* 模式 */
  const modeCard = el('div', 'asoul-card')
  modeCard.appendChild(el('h3', undefined, '模式'))
  const modeRow = el('div', 'asoul-seg')
  modeBtns = {}
  const modeDefs: ReadonlyArray<[AsoulMode, string]> = [['light', '亮色'], ['dark', '夜间'], ['system', '跟随系统']]
  for (const [id, label] of modeDefs) {
    const btn = el('button', 'asoul-seg-btn', label) as HTMLButtonElement
    btn.type = 'button'
    btn.addEventListener('click', () => {
      if (!cfg) return
      cfg.mode = id
      lastPreference = id
      void applyAndSave()
    })
    modeRow.appendChild(btn)
    modeBtns[id] = btn
  }
  modeCard.appendChild(modeRow)
  page.appendChild(modeCard)

  /* 主色调 */
  const accentCard = el('div', 'asoul-card')
  accentCard.appendChild(el('h3', undefined, '主色调'))
  const accentRow = el('div', 'asoul-accents')
  accentBtns = {}
  const accentDefs: ReadonlyArray<{ id: AsoulAccent; label: string; color: string }> = [
    { id: 'default', label: '默认（当前）', color: '#4176E6' },
    { id: 'coffee', label: '咖啡色', color: '#925E37' },
    { id: 'green', label: '豆沙绿', color: '#4A7C59' },
    { id: 'bella', label: '贝拉', color: '#BD7D74' },
    { id: 'diana', label: '嘉然', color: '#E799B0' },
    { id: 'eileen', label: '乃琳', color: '#576690' },
  ]
  for (const def of accentDefs) {
    const btn = el('button', 'asoul-swatch', def.label) as HTMLButtonElement
    btn.type = 'button'
    const dot = el('span', 'asoul-swatch-dot')
    dot.style.background = def.color
    btn.prepend(dot)
    btn.addEventListener('click', () => {
      if (!cfg) return
      cfg.accent = def.id
      void applyAndSave()
    })
    accentRow.appendChild(btn)
    accentBtns[def.id] = btn
  }
  accentCard.appendChild(accentRow)
  page.appendChild(accentCard)

  /* 背景图 */
  const bgCard = el('div', 'asoul-card')
  bgCard.appendChild(el('h3', undefined, '背景图'))
  const previewWrap = el('div', 'asoul-bg-preview')
  previewImg = el('img', 'asoul-bg-img') as HTMLImageElement
  previewImg.alt = '背景预览'
  previewNone = el('div', 'asoul-bg-none', '未启用背景图')
  previewWrap.appendChild(previewImg)
  previewWrap.appendChild(previewNone)
  bgCard.appendChild(previewWrap)

  const toggleRow = el('div', 'asoul-row')
  toggleRow.appendChild(el('span', 'asoul-row-label', '启用背景图'))
  bgToggle = el('input') as HTMLInputElement
  bgToggle.type = 'checkbox'
  bgToggle.className = 'asoul-check'
  bgToggle.addEventListener('change', () => {
    if (!cfg) return
    cfg.bg.enabled = bgToggle?.checked ?? false
    void applyAndSave()
  })
  toggleRow.appendChild(bgToggle)
  bgCard.appendChild(toggleRow)

  const alpha = sliderRow(bgCard, '图片透明度', 0, 100, (v) => {
    if (!cfg) return
    cfg.bg.alpha = v / 100
    applyVisual()
  }, () => { void applyAndSave() })
  alphaInput = alpha.input
  alphaValue = alpha.value

  const base = sliderRow(bgCard, '底色不透明度', 5, 100, (v) => {
    if (!cfg) return
    cfg.bg.baseOpacity = v / 100
    applyVisual()
  }, () => { void applyAndSave() })
  baseInput = base.input
  baseValue = base.value

  const actions = el('div', 'asoul-actions')
  const fileInput = el('input') as HTMLInputElement
  fileInput.type = 'file'
  fileInput.accept = 'image/*'
  fileInput.style.display = 'none'
  const pickBtn = el('button', 'asoul-btn', '选择图片…') as HTMLButtonElement
  pickBtn.type = 'button'
  pickBtn.addEventListener('click', () => fileInput.click())
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0]
    fileInput.value = ''
    if (!file || !cfg) return
    if (file.size > MAX_IMAGE_BYTES) {
      status(`图片超过 8MB（${(file.size / 1048576).toFixed(1)}MB），请先压缩`, true)
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const url = String(reader.result ?? '')
      if (!url.startsWith('data:image/') || !cfg) {
        status('读取图片失败', true)
        return
      }
      cfg.bg.image = url
      cfg.bg.enabled = true
      void applyAndSave()
    }
    reader.onerror = () => status('读取图片失败', true)
    reader.readAsDataURL(file)
  })
  const defBtn = el('button', 'asoul-btn', '恢复默认图（嘉然）') as HTMLButtonElement
  defBtn.type = 'button'
  defBtn.addEventListener('click', () => {
    if (!cfg) return
    cfg.bg.image = '__default__'
    cfg.bg.enabled = true
    void applyAndSave()
  })
  actions.appendChild(pickBtn)
  actions.appendChild(defBtn)
  bgCard.appendChild(actions)
  bgCard.appendChild(el('p', 'asoul-hint', '底色不透明度越小，壁纸透出越明显（官方壳有 3 层底色叠加，12% 时壁纸清晰可见）。默认图来自插件内置 assets/jiaran_1.jpg；自选图片以 dataURL 存入 ~/.dsh/plugins/dsh-style-asoul/settings.json（上限 8MB）。'))
  page.appendChild(bgCard)

  /* 一键还原 */
  const resetCard = el('div', 'asoul-card')
  resetCard.appendChild(el('h3', undefined, '还原'))
  const resetBtn = el('button', 'asoul-btn danger', '一键还原到系统原始设置') as HTMLButtonElement
  resetBtn.type = 'button'
  resetBtn.addEventListener('click', () => { void doReset() })
  resetCard.appendChild(resetBtn)
  resetCard.appendChild(el('p', 'asoul-hint', '还原 = 恢复插件启用前的主题偏好（亮色/夜间/跟随系统），主色调与背景全部回到系统原样，并清除已保存的自定义配置。'))
  page.appendChild(resetCard)

  statusLine = el('div', 'asoul-status')
  page.appendChild(statusLine)

  container.appendChild(page)
  sync()
  if (cfg?.bg.enabled && cfg.bg.image === '__default__' && !defaultDataUrl) void ensureDefaultImage()

  return () => {
    window.clearTimeout(statusTimer)
    modeBtns = {}
    accentBtns = {}
    bgToggle = null
    alphaInput = null
    alphaValue = null
    baseInput = null
    baseValue = null
    previewImg = null
    previewNone = null
    statusLine = null
  }
}

/** settings.section 组件：React 挂载点 + 原生 DOM 内容。 */
function AsoulSettingsPage(): unknown {
  const ref = React.useRef<HTMLDivElement | null>(null)
  React.useEffect(() => {
    const node = ref.current
    if (!node) return
    return mountPanel(node)
  }, [])
  return React.createElement('div', { ref })
}

/* ── 入口 ── */
export function apply(ctx: CtxLike): void {
  themeServiceRef = ctx.theme
  installSkinCss(ctx)
  // 跟随官方 Appearance 行切换时同步面板显示
  if (typeof ctx.on === 'function') {
    ctx.on('theme/change', (snapshot) => {
      if (snapshot && typeof snapshot.preference === 'string') lastPreference = snapshot.preference
      sync()
    })
  }
  // 设置页注册（settings.section 由官方设置壳声明）
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: PKG,
    order: 40,
    label: () => '外观风格',
  }, AsoulSettingsPage))

  void init()
}

async function init(): Promise<void> {
  const res = await apiCall('get-config')
  cfg = res?.ok && res.config ? normalizeLocal(res.config) : { ...DEFAULT_CONFIG }
  lastPreference = themeServiceRef?.getTheme().preference ?? lastPreference
  if (themeServiceRef && !cfg.originalPreference) {
    // 首次捕获系统原始偏好（一键还原目标），先捕获后应用
    cfg.originalPreference = lastPreference
    void apiCall('set-config', { config: cfg })
  }
  applyVisual()
  if (cfg.bg.enabled && cfg.bg.image === '__default__') void ensureDefaultImage()
  sync()
  reportToHost()
}

/* ── 结构洗涤 CSS（社区方案：结构选择器 + wash 标记，不用哈希类名） ── */
const SKIN_CSS = `
.dshDesktopSidebarSurface { --dsw-specific-sidebar-fill: inherit !important; }
html[${WASH_ATTR}] .dshDesktopSidebarSurface { background-color: transparent !important; }
html[data-windows-titlebar][${WASH_ATTR}] div:has(> [data-shell-overlay]) {
  background-color: transparent !important;
  --dsh-windows-content-radius: 0px !important;
}
html[data-windows-titlebar][${WASH_ATTR}] div:has(> [data-shell-overlay])::before {
  background: linear-gradient(var(--dsw-alias-bg-base), var(--dsw-alias-bg-base)) var(--dsw-alias-bg-base) !important;
}
`

/** 安装洗涤样式表（按 id 复用，重复装配不堆积）。 */
function installSkinCss(ctx: CtxLike): void {
  let sheet = document.getElementById(SKIN_CSS_ID) as HTMLStyleElement | null
  if (sheet === null || String(sheet.tagName || '').toUpperCase() !== 'STYLE') {
    sheet = document.createElement('style')
    sheet.id = SKIN_CSS_ID
    ;(document.head || document.body).appendChild(sheet)
  }
  sheet.textContent = SKIN_CSS
  ctx.effect(() => {
    if (document.getElementById(SKIN_CSS_ID) === sheet) sheet.remove()
  }, `${PKG}: skin css`)
}

/* ── 面板 CSS（全部走主题 token，随明暗/主色调自动适配） ── */
const PANEL_CSS = `
.asoul-page { padding: 20px 24px 48px; max-width: 780px; font-size: 13px; color: var(--dsw-alias-label-primary); }
.asoul-title { margin: 0 0 4px; font-size: 17px; font-weight: 600; }
.asoul-sub { margin: 0 0 20px; color: var(--dsw-alias-label-secondary); font-size: 12px; }
.asoul-card { background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px; padding: 16px; margin-bottom: 14px; }
.asoul-card h3 { margin: 0 0 12px; font-size: 13px; font-weight: 600; }
.asoul-seg { display: inline-flex; gap: 4px; background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; padding: 3px; }
.asoul-seg-btn { border: none; background: transparent; color: var(--dsw-alias-label-secondary); border-radius: 6px; padding: 6px 16px; cursor: pointer; font-size: 13px; font-family: inherit; }
.asoul-seg-btn.on { background: var(--dsw-alias-bg-overlay, #fff); color: var(--dsw-alias-label-primary); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08); }
.asoul-accents { display: flex; gap: 10px; flex-wrap: wrap; }
.asoul-swatch { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 999px; border: 1.5px solid var(--dsw-alias-border-l2); background: transparent; color: var(--dsw-alias-label-primary); cursor: pointer; font-size: 13px; font-family: inherit; }
.asoul-swatch.on { border-color: var(--dsw-alias-state-business-primary, #4176E6); box-shadow: 0 0 0 1px var(--dsw-alias-state-business-primary, #4176E6); }
.asoul-swatch-dot { width: 16px; height: 16px; border-radius: 50%; display: inline-block; flex: 0 0 auto; }
.asoul-row { display: flex; align-items: center; gap: 10px; margin: 10px 0; }
.asoul-row-label { flex: 0 0 auto; min-width: 96px; color: var(--dsw-alias-label-secondary); font-size: 12px; }
.asoul-range { flex: 1; accent-color: var(--dsw-alias-state-business-primary, #4176E6); }
.asoul-row-value { flex: 0 0 44px; text-align: right; color: var(--dsw-alias-label-secondary); font-size: 12px; font-variant-numeric: tabular-nums; }
.asoul-check { width: 16px; height: 16px; accent-color: var(--dsw-alias-state-business-primary, #4176E6); }
.asoul-actions { display: flex; gap: 8px; margin: 12px 0 4px; flex-wrap: wrap; }
.asoul-btn { border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); border-radius: 8px; padding: 7px 14px; cursor: pointer; font-size: 13px; font-family: inherit; }
.asoul-btn:hover { background: var(--dsw-alias-interactive-bg-hover); }
.asoul-btn.danger { background: var(--dsw-alias-state-error-primary, #d33); border-color: transparent; color: #fff; }
.asoul-btn.danger:hover { opacity: 0.88; background: var(--dsw-alias-state-error-primary, #d33); }
.asoul-hint { margin: 8px 0 0; color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); font-size: 11.5px; line-height: 1.6; }
.asoul-bg-preview { position: relative; border: 1px dashed var(--dsw-alias-border-l2); border-radius: 10px; overflow: hidden; height: 132px; margin-bottom: 6px; display: flex; align-items: center; justify-content: center; background: var(--dsw-alias-bg-layer-2); }
.asoul-bg-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.asoul-bg-none { color: var(--dsw-alias-label-secondary); font-size: 12px; display: flex; }
.asoul-status { margin-top: 4px; min-height: 18px; color: var(--dsw-alias-state-success-primary, #22c55e); font-size: 12px; }
.asoul-status.err { color: var(--dsw-alias-state-error-primary, #d33); }
`
