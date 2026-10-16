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
  data?: unknown
  b64?: string
  added?: number
  skipped?: number
  path?: string
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
          petElExists: petEl !== null && document.body.contains(petEl),
          petDisplay: petEl ? petEl.style.display : 'no-pet-el',
          petEnabled: petData?.pet.enabled ?? null,
          petPanelOpen,
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

  /* 嘉然桌宠 */
  const petCard = el('div', 'asoul-card')
  petCard.appendChild(el('h3', undefined, '嘉然桌宠'))
  const petRow = el('div', 'asoul-row')
  petRow.appendChild(el('span', 'asoul-row-label', '启用桌宠'))
  petToggleInput = el('input') as HTMLInputElement
  petToggleInput.type = 'checkbox'
  petToggleInput.className = 'asoul-check'
  petToggleInput.addEventListener('change', () => {
    const data = petData
    if (!data) return
    data.pet.enabled = petToggleInput?.checked ?? true
    void petSave()
    applyPetVisibility()
  })
  petRow.appendChild(petToggleInput)
  petCard.appendChild(petRow)
  petCard.appendChild(el('p', 'asoul-hint', '右上角悬浮的嘉然桌面宠物：左键拖动位置，右键打开待办面板（主线任务 / 近期任务 / 杂事 / 设置）。待办与位置保存在 ~/.dsh/plugins/dsh-style-asoul/pet.json。'))
  page.appendChild(petCard)
  syncPetToggle()

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
    petToggleInput = null
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

/* ═════════════════════════ 嘉然桌宠模块 ═════════════════════════ */
interface PetTodoItem {
  id: string
  name: string
  tags: string
  priority: string
  done: boolean
}

type PetListKey = 'main' | 'recent' | 'misc'
type PetTab = PetListKey | 'settings'

interface PetDataLike {
  lists: Record<PetListKey, PetTodoItem[]>
  pet: { x: number | null; y: number | null; panelWidth: number; opacity: number; enabled: boolean }
}

/* 桌宠形象（构建期替换为 data URL，避免 dsh-app:// 协议拉大图失败） */
const PET_IMG_SRC = '__DSH_ASOUL_PET_EMBED__'
const PET_LIST_KEYS: PetListKey[] = ['main', 'recent', 'misc']
const PET_LIST_LABELS: Record<PetListKey, string> = { main: '主线任务', recent: '近期任务', misc: '杂事' }

let petData: PetDataLike | null = null
let petEl: HTMLDivElement | null = null
let petPanel: HTMLDivElement | null = null
let petTab: PetTab = 'main'
let petPanelOpen = false
let petDragging = false
let petDrag = { startX: 0, startY: 0, left: 0, top: 0 }
let petItemPopup: HTMLDivElement | null = null
let petStatusLine: HTMLElement | null = null
let petDragFrom: { key: PetListKey; id: string } | null = null
let petToggleInput: HTMLInputElement | null = null

function petGenIdLocal(): string {
  return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/* ── base64 传输助手（dsh-app:// 协议会转坏多字节 UTF-8，中文一律走 base64） ── */
function b64EncodeJson(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  let bin = ''
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

function b64DecodeJson(b64: string): unknown {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
  return JSON.parse(new TextDecoder('utf-8').decode(bytes))
}

function normalizePetDataLocal(raw: unknown): PetDataLike {
  const input = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const listsIn = (typeof input.lists === 'object' && input.lists !== null ? input.lists : {}) as Record<string, unknown>
  const lists: Record<PetListKey, PetTodoItem[]> = { main: [], recent: [], misc: [] }
  for (const key of PET_LIST_KEYS) {
    const arr = listsIn[key]
    if (Array.isArray(arr)) {
      for (const item of arr) {
        const o = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>
        const name = typeof o.name === 'string' ? o.name.trim() : ''
        if (!name) continue
        lists[key].push({
          id: typeof o.id === 'string' && o.id ? o.id : petGenIdLocal(),
          name: name.slice(0, 200),
          tags: typeof o.tags === 'string' ? o.tags.slice(0, 100) : '',
          priority: typeof o.priority === 'string' ? o.priority.slice(0, 20) : '',
          done: o.done === true,
        })
      }
    }
  }
  const petIn = (typeof input.pet === 'object' && input.pet !== null ? input.pet : {}) as Record<string, unknown>
  return {
    lists,
    pet: {
      x: typeof petIn.x === 'number' ? petIn.x : null,
      y: typeof petIn.y === 'number' ? petIn.y : null,
      panelWidth: clamp(Number(petIn.panelWidth ?? 360), 280, 520),
      opacity: clamp(Number(petIn.opacity ?? 0.95), 0.3, 1),
      enabled: typeof petIn.enabled === 'boolean' ? petIn.enabled : true,
    },
  }
}

async function petSave(): Promise<void> {
  const data = petData
  if (!data) return
  const res = await apiCall('set-pet', { b64: b64EncodeJson(data) })
  if (!res || !res.ok) petStatus(`保存失败：${res?.error ?? '未知错误'}`, true)
}

function petStatus(text: string, isErr = false): void {
  if (!petStatusLine) return
  petStatusLine.textContent = text
  petStatusLine.classList.toggle('err', isErr)
}

function applyPetOpacity(): void {
  const o = petData?.pet.opacity ?? 0.95
  if (petEl) petEl.style.opacity = String(o)
  if (petPanel) petPanel.style.opacity = String(o)
}

/** 按开关显示/隐藏桌宠（并同步设置页开关控件）。 */
function applyPetVisibility(): void {
  const enabled = petData?.pet.enabled ?? true
  if (petEl) petEl.style.display = enabled ? 'block' : 'none'
  if (!enabled && petPanelOpen) closePetPanel()
  syncPetToggle()
}

/** 同步「外观风格」页里的桌宠开关显示状态。 */
function syncPetToggle(): void {
  if (!petToggleInput) return
  petToggleInput.checked = petData?.pet.enabled ?? true
}

/* ── 桌宠本体 ── */
function buildPetEl(): HTMLDivElement {
  const holder = document.createElement('div')
  holder.className = 'asoul-pet'
  const img = document.createElement('img')
  img.className = 'asoul-pet-img'
  img.src = PET_IMG_SRC.startsWith('data:image/') ? PET_IMG_SRC : ''
  img.draggable = false
  img.alt = '嘉然桌宠'
  holder.appendChild(img)

  // 左键拖动
  holder.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return
    const rect = holder.getBoundingClientRect()
    petDragging = true
    petDrag = { startX: e.clientX, startY: e.clientY, left: rect.left, top: rect.top }
    try { holder.setPointerCapture(e.pointerId) } catch { /* 忽略 */ }
    e.preventDefault()
  })
  holder.addEventListener('pointermove', (e) => {
    if (!petDragging) return
    const dx = e.clientX - petDrag.startX
    const dy = e.clientY - petDrag.startY
    const w = holder.offsetWidth || 96
    const h = holder.offsetHeight || 96
    const left = clamp(petDrag.left + dx, 0, Math.max(0, window.innerWidth - w))
    const top = clamp(petDrag.top + dy, 0, Math.max(0, window.innerHeight - h))
    holder.style.left = `${Math.round(left)}px`
    holder.style.top = `${Math.round(top)}px`
    holder.style.right = 'auto'
    holder.style.bottom = 'auto'
    positionPetPanel()
  })
  const finishDrag = (): void => {
    if (!petDragging) return
    petDragging = false
    const rect = holder.getBoundingClientRect()
    const data = petData
    if (data) {
      data.pet.x = Math.round(rect.left)
      data.pet.y = Math.round(rect.top)
      void petSave()
    }
  }
  holder.addEventListener('pointerup', finishDrag)
  holder.addEventListener('pointercancel', finishDrag)

  // 右键弹出面板
  holder.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    togglePetPanel()
  })
  return holder
}

/* ── 面板 ── */
function buildPetPanel(): HTMLDivElement {
  const panel = document.createElement('div')
  panel.className = 'asoul-petpanel'
  const tabs = document.createElement('div')
  tabs.className = 'asoul-petpanel-tabs'
  const body = document.createElement('div')
  body.className = 'asoul-petpanel-body'
  panel.appendChild(tabs)
  panel.appendChild(body)

  const renderTabs = (): void => {
    tabs.textContent = ''
    const defs: Array<[PetTab, string]> = [['main', '主线任务'], ['recent', '近期任务'], ['misc', '杂事'], ['settings', '设置']]
    for (const [key, label] of defs) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'asoul-petpanel-tab' + (petTab === key ? ' on' : '')
      btn.textContent = label
      btn.addEventListener('click', () => {
        petTab = key
        renderTabs()
        renderPetBody(body)
      })
      tabs.appendChild(btn)
    }
  }
  renderTabs()
  renderPetBody(body)
  return panel
}

function renderPetBody(body: HTMLElement): void {
  body.textContent = ''
  closePetItemPopup()
  if (petTab === 'settings') {
    renderPetSettings(body)
    return
  }
  const key = petTab as PetListKey
  const data = petData
  const list = data ? data.lists[key] : []
  body.appendChild(el('div', 'asoul-petpanel-title', PET_LIST_LABELS[key]))
  if (list.length === 0) {
    body.appendChild(el('div', 'asoul-pet-empty', '（暂无待办）'))
    return
  }
  const listEl = el('div', 'asoul-pet-list')
  for (const item of list) listEl.appendChild(renderPetItem(key, item))
  body.appendChild(listEl)
}

function renderPetItem(key: PetListKey, item: PetTodoItem): HTMLElement {
  const row = el('div', 'asoul-pet-item')
  row.draggable = true
  if (item.done) row.classList.add('done')

  // 左侧：名称 + tags/优先级
  const main = el('div', 'asoul-pet-item-main')
  main.appendChild(el('div', 'asoul-pet-item-name', item.name))
  const meta = el('div', 'asoul-pet-item-meta')
  if (item.tags) meta.appendChild(el('span', 'asoul-pet-item-tags', item.tags))
  if (item.priority) meta.appendChild(el('span', 'asoul-pet-item-prio', item.priority))
  if (meta.childNodes.length > 0) main.appendChild(meta)
  row.appendChild(main)

  // 右侧：编辑按钮 + 方形勾选框（空框 ⇄ 带对号），打勾整条半透明
  const editBtn = el('button', 'asoul-pet-editbtn', '✎') as HTMLButtonElement
  editBtn.type = 'button'
  editBtn.title = '编辑'
  editBtn.setAttribute('aria-label', '编辑')
  editBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    startEditItem(key, item, row)
  })
  row.appendChild(editBtn)

  const check = el('button', 'asoul-pet-check' + (item.done ? ' on' : '')) as HTMLButtonElement
  check.type = 'button'
  check.setAttribute('aria-label', item.done ? '标记为未解决' : '标记为已解决')
  check.textContent = item.done ? '✓' : ''
  check.addEventListener('click', (e) => {
    e.stopPropagation()
    item.done = !item.done
    check.classList.toggle('on', item.done)
    check.textContent = item.done ? '✓' : ''
    row.classList.toggle('done', item.done)
    check.setAttribute('aria-label', item.done ? '标记为未解决' : '标记为已解决')
    void petSave()
  })
  row.appendChild(check)

  // 拖动排序
  row.addEventListener('dragstart', (e) => {
    petDragFrom = { key, id: item.id }
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
    row.classList.add('dragging')
  })
  row.addEventListener('dragend', () => {
    petDragFrom = null
    row.classList.remove('dragging')
  })
  row.addEventListener('dragover', (e) => {
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  })
  row.addEventListener('drop', (e) => {
    e.preventDefault()
    const fromRef = petDragFrom
    const data = petData
    if (!fromRef || !data) return
    if (fromRef.key !== key) return
    const list = data.lists[key]
    const from = list.findIndex((t) => t.id === fromRef.id)
    const to = list.findIndex((t) => t.id === item.id)
    if (from < 0 || to < 0 || from === to) return
    const [moved] = list.splice(from, 1)
    list.splice(to, 0, moved)
    void petSave()
    refreshPetPanelBody()
  })

  // 点击弹出 删除/取消（编辑态下不弹）
  row.addEventListener('click', () => {
    if (row.dataset.editing === '1') return
    closePetItemPopup()
    const pop = el('div', 'asoul-pet-item-pop')
    const del = el('button', 'asoul-pet-pop-btn danger', '删除') as HTMLButtonElement
    const cancel = el('button', 'asoul-pet-pop-btn', '取消') as HTMLButtonElement
    del.type = 'button'
    cancel.type = 'button'
    del.addEventListener('click', (e) => {
      e.stopPropagation()
      const data = petData
      if (!data) return
      data.lists[key] = data.lists[key].filter((t) => t.id !== item.id)
      void petSave()
      refreshPetPanelBody()
    })
    cancel.addEventListener('click', (e) => {
      e.stopPropagation()
      pop.remove()
      petItemPopup = null
    })
    pop.appendChild(del)
    pop.appendChild(cancel)
    row.appendChild(pop)
    petItemPopup = pop
  })
  return row
}

function closePetItemPopup(): void {
  if (petItemPopup) {
    petItemPopup.remove()
    petItemPopup = null
  }
}

/** 行内编辑：把一条待办替换为编辑表单（名称/tags/优先级），保存后同步 pet.json。 */
function startEditItem(key: PetListKey, item: PetTodoItem, row: HTMLElement): void {
  closePetItemPopup()
  row.draggable = false
  row.dataset.editing = '1'
  row.classList.add('editing')
  row.textContent = ''

  const form = el('div', 'asoul-pet-edit')
  const nameInput = el('input') as HTMLInputElement
  nameInput.value = item.name
  nameInput.placeholder = '名称'
  const tagsInput = el('input') as HTMLInputElement
  tagsInput.value = item.tags
  tagsInput.placeholder = 'tags（可选）'
  const prioSel = el('select') as HTMLSelectElement
  for (const p of ['', '高', '中', '低']) {
    const opt = document.createElement('option')
    opt.value = p
    opt.textContent = p === '' ? '优先级（可选）' : p
    prioSel.appendChild(opt)
  }
  prioSel.value = item.priority

  const btnRow = el('div', 'asoul-pet-edit-actions')
  const saveBtn = el('button', 'asoul-pet-btn primary', '保存') as HTMLButtonElement
  saveBtn.type = 'button'
  saveBtn.addEventListener('click', () => {
    const name = nameInput.value.trim()
    if (!name) {
      petStatus('名称不能为空', true)
      return
    }
    item.name = name.slice(0, 200)
    item.tags = tagsInput.value.trim().slice(0, 100)
    item.priority = prioSel.value
    void petSave()
    petStatus('已保存')
    refreshPetPanelBody()
  })
  const cancelBtn = el('button', 'asoul-pet-btn', '取消') as HTMLButtonElement
  cancelBtn.type = 'button'
  cancelBtn.addEventListener('click', () => {
    refreshPetPanelBody()
  })
  btnRow.append(saveBtn, cancelBtn)
  form.append(nameInput, tagsInput, prioSel, btnRow)
  row.appendChild(form)
}

function refreshPetPanelBody(): void {
  if (!petPanel) return
  const body = petPanel.querySelector('.asoul-petpanel-body') as HTMLElement | null
  if (!body) return
  renderPetBody(body)
}

function petSliderRow(parent: HTMLElement, label: string, min: number, max: number, value: string, onInput: (v: number) => void, onChange: () => void): void {
  const row = el('div', 'asoul-pet-row')
  row.appendChild(el('span', 'asoul-pet-row-label', label))
  const input = el('input') as HTMLInputElement
  input.type = 'range'
  input.min = String(min)
  input.max = String(max)
  input.step = '1'
  input.value = value
  input.className = 'asoul-pet-range'
  input.addEventListener('input', () => onInput(Number(input.value)))
  input.addEventListener('change', () => onChange())
  const val = el('span', 'asoul-pet-row-value', input.value)
  input.addEventListener('input', () => { val.textContent = input.value })
  row.appendChild(input)
  row.appendChild(val)
  parent.appendChild(row)
}

function renderPetSettings(body: HTMLElement): void {
  const data = petData
  if (!data) return
  body.appendChild(el('div', 'asoul-petpanel-title', '设置'))

  petSliderRow(body, '面板大小', 280, 520, String(Math.round(data.pet.panelWidth)), (v) => {
    data.pet.panelWidth = v
    if (petPanel) petPanel.style.width = `${v}px`
  }, () => { void petSave() })

  petSliderRow(body, '整体透明度', 30, 100, String(Math.round(data.pet.opacity * 100)), (v) => {
    data.pet.opacity = v / 100
    applyPetOpacity()
  }, () => { void petSave() })

  // 添加待办
  const form = el('div', 'asoul-pet-form')
  const listSel = el('select') as HTMLSelectElement
  for (const k of PET_LIST_KEYS) {
    const opt = document.createElement('option')
    opt.value = k
    opt.textContent = PET_LIST_LABELS[k]
    listSel.appendChild(opt)
  }
  const nameInput = el('input') as HTMLInputElement
  nameInput.placeholder = '名称'
  const tagsInput = el('input') as HTMLInputElement
  tagsInput.placeholder = 'tags（可选）'
  const prioSel = el('select') as HTMLSelectElement
  for (const p of ['', '高', '中', '低']) {
    const opt = document.createElement('option')
    opt.value = p
    opt.textContent = p === '' ? '优先级（可选）' : p
    prioSel.appendChild(opt)
  }
  const addBtn = el('button', 'asoul-pet-btn primary', '添加') as HTMLButtonElement
  addBtn.type = 'button'
  addBtn.addEventListener('click', () => {
    const name = nameInput.value.trim()
    if (!name) {
      petStatus('请先填写名称', true)
      return
    }
    const data2 = petData
    if (!data2) return
    data2.lists[listSel.value as PetListKey].push({
      id: petGenIdLocal(),
      name,
      tags: tagsInput.value.trim(),
      priority: prioSel.value,
      done: false,
    })
    nameInput.value = ''
    tagsInput.value = ''
    void petSave()
    petStatus('已添加')
  })
  form.append(listSel, nameInput, tagsInput, prioSel, addBtn)
  body.appendChild(form)

  // 导出 / 导入
  const ioRow = el('div', 'asoul-pet-actions')
  const exportBtn = el('button', 'asoul-pet-btn', '导出 CSV') as HTMLButtonElement
  exportBtn.type = 'button'
  exportBtn.addEventListener('click', () => {
    void apiCall('export-todos', {}).then((res) => {
      if (res?.ok) petStatus(`已导出：${res.path ?? ''}`)
      else petStatus(`导出失败：${res?.error ?? '未知错误'}`, true)
    })
  })
  const importBtn = el('button', 'asoul-pet-btn', '导入（json / csv）') as HTMLButtonElement
  importBtn.type = 'button'
  const fileInput = el('input') as HTMLInputElement
  fileInput.type = 'file'
  fileInput.accept = '.json,.csv,application/json,text/csv'
  fileInput.style.display = 'none'
  importBtn.addEventListener('click', () => fileInput.click())
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0]
    fileInput.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      void handlePetImport(String(reader.result ?? ''), file.name)
    }
    reader.onerror = () => petStatus('读取文件失败', true)
    reader.readAsText(file)
  })
  ioRow.append(exportBtn, importBtn)
  body.appendChild(ioRow)

  body.appendChild(el('p', 'asoul-pet-hint', '导入格式：JSON 数组 [{name, tags?, priority?, list?, done?}]；CSV 表头 name,tags,priority,list,done。list 可写 主线任务/近期任务/杂事 或 main/recent/misc，缺省为杂事；done 为 1/0（或 true/false、是/完成）表示已解决。按名称去重、只追加不覆盖。导出文件保存到 ~/.dsh/plugins/dsh-style-asoul/exports/。'))

  petStatusLine = el('div', 'asoul-pet-status')
  body.appendChild(petStatusLine)
}

/* ── CSV 解析/构建 ── */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1
      row.push(field)
      field = ''
      if (row.some((c) => c.trim() !== '')) rows.push(row)
      row = []
    } else {
      field += ch
    }
  }
  row.push(field)
  if (row.some((c) => c.trim() !== '')) rows.push(row)
  return rows
}

/** 解析 CSV done 列：1/true/是/完成/✓/y/yes 视为已解决。 */
function parseDoneValue(v: string): boolean {
  const s = v.trim().toLowerCase()
  return s === '1' || s === 'true' || s === '是' || s === '完成' || s === '✓' || s === 'y' || s === 'yes'
}

function listKeyOf(value: string): PetListKey | null {
  const v = value.trim()
  if (v === 'main' || v === '主线任务') return 'main'
  if (v === 'recent' || v === '近期任务') return 'recent'
  if (v === 'misc' || v === '杂事') return 'misc'
  return null
}

async function handlePetImport(text: string, fileName: string): Promise<void> {
  const isCsv = /\.csv$/i.test(fileName)
  const rawRows: Array<Record<string, unknown>> = []
  if (isCsv) {
    const rows = parseCsvRows(text.replace(/^\uFEFF/, ''))
    if (rows.length === 0) {
      petStatus('导入失败：文件为空', true)
      return
    }
    const header = rows[0].map((c) => c.trim().toLowerCase())
    const nameIdx = header.indexOf('name')
    if (nameIdx < 0) {
      petStatus('导入失败：CSV 缺 name 列（表头应为 name,tags,priority,list）', true)
      return
    }
    const tagsIdx = header.indexOf('tags')
    const prioIdx = header.indexOf('priority')
    const listIdx = header.indexOf('list')
    const doneIdx = header.indexOf('done')
    for (let i = 1; i < rows.length; i += 1) {
      const r = rows[i]
      const obj: Record<string, unknown> = { name: (r[nameIdx] ?? '').trim() }
      if (tagsIdx >= 0 && r[tagsIdx] !== undefined) obj.tags = r[tagsIdx].trim()
      if (prioIdx >= 0 && r[prioIdx] !== undefined) obj.priority = r[prioIdx].trim()
      if (listIdx >= 0 && r[listIdx] !== undefined) {
        const k = listKeyOf(r[listIdx])
        if (k) obj.list = k
      }
      if (doneIdx >= 0 && r[doneIdx] !== undefined) obj.done = parseDoneValue(r[doneIdx])
      rawRows.push(obj)
    }
  } else {
    try {
      const parsed = JSON.parse(text) as unknown
      let arr: unknown[] | null = null
      if (Array.isArray(parsed)) {
        arr = parsed
      } else if (typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { items?: unknown }).items)) {
        arr = (parsed as { items: unknown[] }).items
      }
      if (!arr) {
        petStatus('导入失败：JSON 应为数组，或含 items 数组的对象', true)
        return
      }
      rawRows.push(...arr.map((r) => (typeof r === 'object' && r !== null ? r as Record<string, unknown> : { name: String(r) })))
    } catch {
      petStatus('导入失败：JSON 格式非法', true)
      return
    }
  }
  // 逐行校验并按目标列表分组
  const grouped: Record<PetListKey, Array<{ id: string; name: string; tags: string; priority: string; done: boolean }>> = { main: [], recent: [], misc: [] }
  for (const r of rawRows) {
    const name = typeof r.name === 'string' ? r.name.trim() : ''
    if (!name) continue
    const list: PetListKey = typeof r.list === 'string' ? (listKeyOf(r.list) ?? 'misc') : 'misc'
    grouped[list].push({
      id: petGenIdLocal(),
      name: name.slice(0, 200),
      tags: typeof r.tags === 'string' ? r.tags.slice(0, 100) : '',
      priority: typeof r.priority === 'string' ? r.priority.slice(0, 20) : '',
      done: r.done === true,
    })
  }
  let total = 0
  for (const key of PET_LIST_KEYS) total += grouped[key].length
  if (total === 0) {
    petStatus('导入失败：没有有效条目（name 不能为空）', true)
    return
  }
  let added = 0
  let skipped = 0
  for (const key of PET_LIST_KEYS) {
    const rows2 = grouped[key]
    if (rows2.length === 0) continue
    const res = await apiCall('import-todos', { b64: b64EncodeJson({ items: rows2, list: key }) })
    if (res?.ok) {
      added += res.added ?? 0
      skipped += res.skipped ?? 0
      if (typeof res.b64 === 'string' && res.b64) {
        try { petData = normalizePetDataLocal(b64DecodeJson(res.b64)) } catch { /* 忽略 */ }
      }
    } else {
      petStatus(`导入失败：${res?.error ?? '未知错误'}`, true)
      return
    }
  }
  refreshPetPanelBody()
  petStatus(`导入完成：新增 ${added} 条，跳过重复 ${skipped} 条`)
}

/* ── 面板开合与定位 ── */
function togglePetPanel(): void {
  if (petPanelOpen) closePetPanel()
  else openPetPanel()
}

function openPetPanel(): void {
  if (!petPanel) return
  petPanelOpen = true
  petPanel.style.display = 'flex'
  positionPetPanel()
  refreshPetPanelBody()
}

function closePetPanel(): void {
  if (!petPanel) return
  petPanelOpen = false
  petPanel.style.display = 'none'
  closePetItemPopup()
}

function positionPetPanel(): void {
  if (!petPanel || !petEl) return
  const pr = petEl.getBoundingClientRect()
  const w = petData?.pet.panelWidth ?? 360
  const maxH = Math.min(window.innerHeight - 24, 560)
  const leftSpace = pr.left
  const rightSpace = window.innerWidth - pr.right
  let left: number
  if (leftSpace >= w + 24) left = pr.left - w - 12
  else if (rightSpace >= w + 24) left = pr.right + 12
  else left = Math.max(8, window.innerWidth - w - 8)
  const top = clamp(pr.top, 8, Math.max(8, window.innerHeight - maxH - 8))
  petPanel.style.left = `${Math.round(left)}px`
  petPanel.style.top = `${Math.round(top)}px`
  petPanel.style.width = `${w}px`
  petPanel.style.maxHeight = `${maxH}px`
}

/* ── 桌宠初始化 ── */
function initPet(ctx: CtxLike): void {
  const style = document.createElement('style')
  style.id = 'dsh-style-asoul-pet-css'
  style.textContent = PET_CSS

  const pet = buildPetEl()
  petEl = pet
  pet.style.right = '16px'
  pet.style.top = '16px'

  const panel = buildPetPanel()
  petPanel = panel
  panel.style.display = 'none'
  panel.style.opacity = '0.95'

  const onDocMouseDown = (e: MouseEvent): void => {
    if (!petPanelOpen) return
    const t = e.target as Node | null
    if (t && pet.contains(t)) return
    if (t && panel.contains(t)) return
    closePetPanel()
  }

  // ⚠️ cordis ctx.effect 语义：回调立即执行（注册资源），返回函数才是 dispose 清理。
  // 挂载必须放在回调体里，清理放在返回值里——否则桌宠刚挂载就被删掉（上一版 bug）。
  ctx.effect(() => {
    ;(document.head || document.body).appendChild(style)
    document.body.appendChild(pet)
    document.body.appendChild(panel)
    document.addEventListener('mousedown', onDocMouseDown)
    return () => {
      pet.remove()
      panel.remove()
      document.removeEventListener('mousedown', onDocMouseDown)
      style.remove()
      petEl = null
      petPanel = null
      petStatusLine = null
      petItemPopup = null
    }
  }, `${PKG}: desktop pet`)

  void (async () => {
    const res = await apiCall('get-pet')
    let loaded: unknown = null
    if (res?.ok && typeof res.b64 === 'string' && res.b64) {
      try { loaded = b64DecodeJson(res.b64) } catch { loaded = null }
    }
    petData = loaded ? normalizePetDataLocal(loaded) : { lists: { main: [], recent: [], misc: [] }, pet: { x: null, y: null, panelWidth: 360, opacity: 0.95, enabled: true } }
    const { x, y, panelWidth, opacity } = petData.pet
    if (x !== null && y !== null) {
      pet.style.left = `${Math.round(x)}px`
      pet.style.top = `${Math.round(y)}px`
      pet.style.right = 'auto'
    }
    panel.style.width = `${panelWidth}px`
    panel.style.opacity = String(opacity)
    applyPetOpacity()
    applyPetVisibility()
    refreshPetPanelBody()
  })()
}

/* ── 桌宠样式（主色 #E799B0，面板底色更淡的粉） ── */
const PET_CSS = `
.asoul-pet {
  position: fixed;
  z-index: 2147483000;
  width: 96px;
  height: 96px;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  -webkit-app-region: no-drag;
  touch-action: none;
}
.asoul-pet:active { cursor: grabbing; }
.asoul-pet-img {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  object-fit: cover;
  object-position: 50% 18%;
  border: 3px solid #E799B0;
  box-shadow: 0 4px 16px rgba(231, 153, 176, 0.55);
  display: block;
  pointer-events: none;
  background: #FDEFF4;
}
.asoul-petpanel {
  position: fixed;
  z-index: 2147482999;
  display: flex;
  flex-direction: row;
  background: #FFF9FB;
  border: 1px solid #F2C7D6;
  border-radius: 14px;
  box-shadow: 0 8px 28px rgba(231, 153, 176, 0.35);
  overflow: hidden;
  color: #4A3540;
  font-size: 13px;
}
.asoul-petpanel-tabs {
  display: flex;
  flex-direction: column;
  width: 84px;
  flex: 0 0 84px;
  background: #FDEFF4;
  padding: 10px 6px;
  gap: 4px;
  border-right: 1px solid #F6D7E2;
}
.asoul-petpanel-tab {
  border: none;
  background: transparent;
  color: #8A6E7B;
  padding: 8px 6px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
  text-align: left;
}
.asoul-petpanel-tab:hover { background: rgba(231, 153, 176, 0.18); }
.asoul-petpanel-tab.on { background: #E799B0; color: #fff; font-weight: 600; }
.asoul-petpanel-body {
  flex: 1;
  min-width: 0;
  padding: 12px 14px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.asoul-petpanel-title { font-weight: 600; color: #C96E8B; font-size: 13px; }
.asoul-pet-empty { color: #B8A4AC; font-size: 12px; padding: 10px 0; }
.asoul-pet-list { display: flex; flex-direction: column; gap: 6px; }
.asoul-pet-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  background: #FFFFFF;
  border: 1px solid #F8E3EA;
  border-radius: 10px;
  padding: 8px 10px;
  cursor: pointer;
}
.asoul-pet-item:hover { border-color: #E799B0; }
.asoul-pet-item.dragging { opacity: 0.5; }
.asoul-pet-item.done { opacity: 0.5; }
.asoul-pet-item.editing { cursor: default; }
.asoul-pet-item-main { flex: 1; min-width: 0; }
.asoul-pet-editbtn {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  border: none;
  background: transparent;
  color: #C9A3B1;
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
  padding: 0;
  font-family: inherit;
}
.asoul-pet-editbtn:hover { color: #E799B0; }
.asoul-pet-edit { display: flex; flex-direction: column; gap: 6px; flex: 1; }
.asoul-pet-edit input, .asoul-pet-edit select {
  border: 1px solid #F2C7D6;
  border-radius: 8px;
  padding: 6px 8px;
  font-size: 12px;
  font-family: "Microsoft YaHei", "微软雅黑", "PingFang SC", sans-serif;
  color: #4A3540;
  background: #fff;
  outline: none;
}
.asoul-pet-edit input:focus, .asoul-pet-edit select:focus { border-color: #E799B0; }
.asoul-pet-edit-actions { display: flex; gap: 6px; }
.asoul-pet-check {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  border: 1.5px solid #E3A8BC;
  border-radius: 5px;
  background: #FFFFFF;
  color: #FFFFFF;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  line-height: 1;
  padding: 0;
  font-family: inherit;
  transition: background-color 0.12s ease;
}
.asoul-pet-check:hover { border-color: #E799B0; }
.asoul-pet-check.on { background: #E799B0; border-color: #E799B0; }
.asoul-pet-item-name {
  font-family: "Microsoft YaHei", "微软雅黑", "PingFang SC", sans-serif;
  font-size: 13px;
  color: #4A3540;
  word-break: break-all;
}
.asoul-pet-item-meta {
  display: flex;
  gap: 8px;
  margin-top: 3px;
  align-items: baseline;
  flex-wrap: wrap;
}
.asoul-pet-item-tags { color: #A99BA2; font-size: 11px; }
.asoul-pet-item-prio { color: #A99BA2; font-size: 11px; }
.asoul-pet-item-pop {
  position: absolute;
  top: 4px;
  right: 6px;
  display: flex;
  gap: 4px;
  background: #FFF9FB;
  border-radius: 8px;
  padding: 2px;
}
.asoul-pet-pop-btn {
  border: 1px solid #F2C7D6;
  background: #FFFFFF;
  color: #8A6E7B;
  border-radius: 6px;
  padding: 2px 8px;
  cursor: pointer;
  font-size: 11px;
  font-family: inherit;
}
.asoul-pet-pop-btn.danger { background: #E799B0; border-color: #E799B0; color: #fff; }
.asoul-pet-row { display: flex; align-items: center; gap: 8px; }
.asoul-pet-row-label { flex: 0 0 auto; min-width: 68px; color: #8A6E7B; font-size: 12px; }
.asoul-pet-range { flex: 1; accent-color: #E799B0; }
.asoul-pet-row-value { flex: 0 0 36px; text-align: right; color: #8A6E7B; font-size: 11px; font-variant-numeric: tabular-nums; }
.asoul-pet-form { display: flex; flex-direction: column; gap: 6px; }
.asoul-pet-form input, .asoul-pet-form select {
  border: 1px solid #F2C7D6;
  border-radius: 8px;
  padding: 6px 8px;
  font-size: 12px;
  font-family: "Microsoft YaHei", "微软雅黑", "PingFang SC", sans-serif;
  color: #4A3540;
  background: #fff;
  outline: none;
}
.asoul-pet-form input:focus, .asoul-pet-form select:focus { border-color: #E799B0; }
.asoul-pet-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.asoul-pet-btn {
  border: 1px solid #F2C7D6;
  background: #FFFFFF;
  color: #8A6E7B;
  border-radius: 8px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
}
.asoul-pet-btn:hover { background: #FDEFF4; }
.asoul-pet-btn.primary { background: #E799B0; border-color: #E799B0; color: #fff; }
.asoul-pet-btn.primary:hover { background: #Df8ea5; }
.asoul-pet-hint { color: #B8A4AC; font-size: 11px; line-height: 1.5; margin: 0; }
.asoul-pet-status { color: #7FBF8F; font-size: 12px; min-height: 16px; }
.asoul-pet-status.err { color: #D2647F; }
`

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

  // 嘉然桌宠（悬浮 + 拖拽 + Todo 面板）
  initPet(ctx)

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
  }
  sheet.textContent = SKIN_CSS
  // ⚠️ cordis ctx.effect：回调立即执行（挂载），返回函数为 dispose 清理。
  ctx.effect(() => {
    if (sheet !== null && document.getElementById(SKIN_CSS_ID) !== sheet) {
      ;(document.head || document.body).appendChild(sheet)
    }
    return () => {
      if (document.getElementById(SKIN_CSS_ID) === sheet) sheet.remove()
    }
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
