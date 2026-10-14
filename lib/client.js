window.__ModuleLoader__.load({
  id: "dsh-style-asoul",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inject = void 0;
exports.apply = apply;
/**
 * dsh-style-asoul — A-SOUL 外观风格插件（client 半边）
 *
 * 能力：
 *  1. 外观设置页（settings.section「外观风格」）：模式（亮色/夜间/跟随系统）、
 *     主色调（默认/咖啡色/豆沙绿）、背景图（开关/透明度/透出强度/自选图片/
 *     恢复默认）、一键还原到系统原始设置。
 *  2. 风格引擎：通过官方 theme 服务 setTheme + overrideTokens 应用模式与主色调；
 *     背景图通过 body::before 固定层 + 半透明 bg-base 呈现。
 *  3. 持久化：配置经 host API 存至 ~/.dsh/plugins/dsh-style-asoul/settings.json。
 *
 * 依赖：inject ['slots']；theme 服务通过 ctx.get('theme') 探测（可选）。
 */
const PKG = 'dsh-style-asoul';
const API = `/${PKG}/api`;
const OVERRIDE_ACCENT = `${PKG}/accent`;
const OVERRIDE_BASE = `${PKG}/bg-base`;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
exports.inject = ['slots'];
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const React = require('react');
const DEFAULT_CONFIG = {
    mode: 'light',
    accent: 'default',
    bg: { enabled: true, image: '__default__', alpha: 0.3, baseOpacity: 0.6 },
};
const ACCENT_PALETTES = {
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
};
/* ── 引擎状态 ── */
let cfg = null;
let theme = null;
let lastPreference = 'system';
let defaultDataUrl = '';
let accentDispose = null;
let baseDispose = null;
/* ── 面板 UI 引用（sync 时刷新） ── */
let modeBtns = {};
let accentBtns = {};
let bgToggle = null;
let alphaInput = null;
let alphaValue = null;
let baseInput = null;
let baseValue = null;
let previewImg = null;
let previewNone = null;
let statusLine = null;
let statusTimer = 0;
/* ── 工具 ── */
function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls)
        node.className = cls;
    if (text !== undefined)
        node.textContent = text;
    return node;
}
function isThemeService(v) {
    return typeof v === 'object' && v !== null
        && typeof v.getTheme === 'function'
        && typeof v.setTheme === 'function'
        && typeof v.overrideTokens === 'function';
}
function clamp(n, lo, hi) {
    if (typeof n !== 'number' || Number.isNaN(n))
        return lo;
    return Math.min(hi, Math.max(lo, n));
}
function normalizeLocal(raw) {
    const input = (typeof raw === 'object' && raw !== null ? raw : {});
    const bgIn = (typeof input.bg === 'object' && input.bg !== null ? input.bg : {});
    const mode = input.mode === 'dark' || input.mode === 'system' || input.mode === 'light' ? input.mode : DEFAULT_CONFIG.mode;
    const accent = input.accent === 'coffee' || input.accent === 'green' || input.accent === 'default' ? input.accent : DEFAULT_CONFIG.accent;
    const out = {
        mode,
        accent,
        bg: {
            enabled: typeof bgIn.enabled === 'boolean' ? bgIn.enabled : DEFAULT_CONFIG.bg.enabled,
            image: typeof bgIn.image === 'string' ? bgIn.image : DEFAULT_CONFIG.bg.image,
            alpha: clamp(Number(bgIn.alpha), 0, 1),
            baseOpacity: clamp(Number(bgIn.baseOpacity), 0.05, 1),
        },
    };
    const orig = input.originalPreference;
    if (orig === 'light' || orig === 'dark' || orig === 'system')
        out.originalPreference = orig;
    return out;
}
async function apiCall(method, args) {
    try {
        const res = await fetch(API, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ method, args: args ?? {} }),
        });
        return (await res.json());
    }
    catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}
function status(text, isErr = false) {
    if (!statusLine)
        return;
    const line = statusLine;
    line.textContent = text;
    line.classList.toggle('err', isErr);
    window.clearTimeout(statusTimer);
    if (!isErr) {
        statusTimer = window.setTimeout(() => {
            line.textContent = '';
        }, 2600);
    }
}
/* ── 风格引擎 ── */
function resolveImageUrl() {
    const c = cfg;
    if (!c || !c.bg.enabled)
        return '';
    if (c.bg.image === '__default__')
        return defaultDataUrl;
    return c.bg.image.startsWith('data:image/') ? c.bg.image : '';
}
function cssUrl(url) {
    return url.replace(/["'\\\n\r]/g, '');
}
function applyBgDom() {
    const c = cfg;
    const html = document.documentElement;
    if (!c || !c.bg.enabled) {
        html.classList.remove('dsh-style-asoul-bg');
        html.style.removeProperty('--dsh-style-asoul-bg-image');
        html.style.removeProperty('--dsh-style-asoul-bg-alpha');
        return;
    }
    const url = resolveImageUrl();
    html.classList.add('dsh-style-asoul-bg');
    html.style.setProperty('--dsh-style-asoul-bg-image', url ? `url("${cssUrl(url)}")` : 'none');
    html.style.setProperty('--dsh-style-asoul-bg-alpha', String(clamp(c.bg.alpha, 0, 1)));
}
/** 将当前配置实时应用到界面（不落盘）。 */
function applyVisual() {
    const c = cfg;
    if (!c)
        return;
    if (theme) {
        accentDispose?.();
        accentDispose = null;
        if (c.accent !== 'default') {
            accentDispose = theme.overrideTokens(OVERRIDE_ACCENT, ACCENT_PALETTES[c.accent]);
        }
        baseDispose?.();
        baseDispose = null;
        if (c.bg.enabled) {
            baseDispose = theme.overrideTokens(OVERRIDE_BASE, {
                '--dsw-alias-bg-base': {
                    light: `rgba(255, 255, 255, ${clamp(c.bg.baseOpacity, 0.05, 1)})`,
                    dark: `rgba(21, 21, 23, ${clamp(c.bg.baseOpacity, 0.05, 1)})`,
                },
            });
        }
        theme.setTheme(c.mode);
    }
    applyBgDom();
    sync();
}
async function ensureDefaultImage() {
    if (defaultDataUrl)
        return;
    const res = await apiCall('get-default-image');
    if (res?.ok && typeof res.dataUrl === 'string' && res.dataUrl.startsWith('data:image/')) {
        defaultDataUrl = res.dataUrl;
        applyBgDom();
        sync();
    }
}
async function applyAndSave() {
    const c = cfg;
    if (!c)
        return;
    applyVisual();
    if (c.bg.enabled && c.bg.image === '__default__')
        await ensureDefaultImage();
    const res = await apiCall('set-config', { config: c });
    if (res && !res.ok) {
        status(`保存失败：${res.error ?? '未知错误'}`, true);
    }
    else {
        status('已保存');
    }
    sync();
}
/** 一键还原：恢复插件启用前的主题偏好，清除主色调/背景，并以中性配置落盘。 */
async function doReset() {
    const c = cfg;
    if (!c)
        return;
    if (!window.confirm('确定还原到插件启用前的系统原始设置吗？主色调、背景图与自定义配置都会被清除。'))
        return;
    const orig = (c.originalPreference === 'light' || c.originalPreference === 'dark' || c.originalPreference === 'system')
        ? c.originalPreference
        : (theme ? (theme.getTheme().preference === 'light' || theme.getTheme().preference === 'dark' || theme.getTheme().preference === 'system' ? theme.getTheme().preference : 'system') : 'system');
    const neutral = {
        mode: orig,
        accent: 'default',
        bg: { enabled: false, image: '__default__', alpha: 0.3, baseOpacity: 0.6 },
        originalPreference: orig,
    };
    const res = await apiCall('set-config', { config: neutral });
    if (!res || !res.ok) {
        status(`还原失败：${res?.error ?? '未知错误'}`, true);
        return;
    }
    cfg = neutral;
    applyVisual();
    status('已还原到系统原始设置');
}
/* ── 主题服务发现 ── */
function adoptTheme(service) {
    theme = service;
    lastPreference = service.getTheme().preference ?? lastPreference;
    if (cfg && !cfg.originalPreference) {
        // 首次捕获系统原始偏好（一键还原目标），先捕获后应用
        cfg.originalPreference = lastPreference;
        void apiCall('set-config', { config: cfg });
    }
    if (cfg)
        applyVisual();
}
function watchTheme(ctx) {
    let tries = 0;
    const timer = window.setInterval(() => {
        const candidate = ctx.get('theme');
        if (isThemeService(candidate)) {
            window.clearInterval(timer);
            adoptTheme(candidate);
        }
        else if (++tries >= 66) {
            window.clearInterval(timer);
        }
    }, 150);
    ctx.effect(() => window.clearInterval(timer), `${PKG}: theme watcher`);
}
/* ── 面板 UI ── */
function sliderRow(parent, label, min, max, onInput, onChange) {
    const row = el('div', 'asoul-row');
    row.appendChild(el('span', 'asoul-row-label', label));
    const input = el('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = '1';
    input.className = 'asoul-range';
    input.addEventListener('input', () => onInput(Number(input.value)));
    input.addEventListener('change', () => onChange());
    const value = el('span', 'asoul-row-value', '');
    row.appendChild(input);
    row.appendChild(value);
    parent.appendChild(row);
    return { input, value };
}
function sync() {
    const c = cfg;
    if (!c)
        return;
    for (const [id, btn] of Object.entries(modeBtns))
        btn.classList.toggle('on', lastPreference === id);
    for (const [id, btn] of Object.entries(accentBtns))
        btn.classList.toggle('on', c.accent === id);
    if (bgToggle)
        bgToggle.checked = c.bg.enabled;
    if (alphaInput)
        alphaInput.value = String(Math.round(c.bg.alpha * 100));
    if (alphaValue)
        alphaValue.textContent = `${Math.round(c.bg.alpha * 100)}%`;
    if (baseInput)
        baseInput.value = String(Math.round(c.bg.baseOpacity * 100));
    if (baseValue)
        baseValue.textContent = `${Math.round(c.bg.baseOpacity * 100)}%`;
    const url = resolveImageUrl();
    if (url && previewImg) {
        previewImg.src = url;
        previewImg.style.display = 'block';
        if (previewNone)
            previewNone.style.display = 'none';
    }
    else {
        if (previewImg)
            previewImg.style.display = 'none';
        if (previewNone)
            previewNone.style.display = 'flex';
    }
}
function mountPanel(container) {
    const style = document.createElement('style');
    style.textContent = PANEL_CSS;
    container.appendChild(style);
    const page = el('div', 'asoul-page');
    page.appendChild(el('h2', 'asoul-title', '外观风格'));
    page.appendChild(el('p', 'asoul-sub', 'dsh-style-asoul v0.1 · 亮色/夜间模式 · 咖啡色/豆沙绿主色调 · 自定义背景图（默认嘉然壁纸）'));
    /* 模式 */
    const modeCard = el('div', 'asoul-card');
    modeCard.appendChild(el('h3', undefined, '模式'));
    const modeRow = el('div', 'asoul-seg');
    modeBtns = {};
    const modeDefs = [['light', '亮色'], ['dark', '夜间'], ['system', '跟随系统']];
    for (const [id, label] of modeDefs) {
        const btn = el('button', 'asoul-seg-btn', label);
        btn.type = 'button';
        btn.addEventListener('click', () => {
            if (!cfg)
                return;
            cfg.mode = id;
            lastPreference = id;
            void applyAndSave();
        });
        modeRow.appendChild(btn);
        modeBtns[id] = btn;
    }
    modeCard.appendChild(modeRow);
    page.appendChild(modeCard);
    /* 主色调 */
    const accentCard = el('div', 'asoul-card');
    accentCard.appendChild(el('h3', undefined, '主色调'));
    const accentRow = el('div', 'asoul-accents');
    accentBtns = {};
    const accentDefs = [
        { id: 'default', label: '默认（当前）', color: '#4176E6' },
        { id: 'coffee', label: '咖啡色', color: '#925E37' },
        { id: 'green', label: '豆沙绿', color: '#4A7C59' },
    ];
    for (const def of accentDefs) {
        const btn = el('button', 'asoul-swatch', def.label);
        btn.type = 'button';
        const dot = el('span', 'asoul-swatch-dot');
        dot.style.background = def.color;
        btn.prepend(dot);
        btn.addEventListener('click', () => {
            if (!cfg)
                return;
            cfg.accent = def.id;
            void applyAndSave();
        });
        accentRow.appendChild(btn);
        accentBtns[def.id] = btn;
    }
    accentCard.appendChild(accentRow);
    page.appendChild(accentCard);
    /* 背景图 */
    const bgCard = el('div', 'asoul-card');
    bgCard.appendChild(el('h3', undefined, '背景图'));
    const previewWrap = el('div', 'asoul-bg-preview');
    previewImg = el('img', 'asoul-bg-img');
    previewImg.alt = '背景预览';
    previewNone = el('div', 'asoul-bg-none', '未启用背景图');
    previewWrap.appendChild(previewImg);
    previewWrap.appendChild(previewNone);
    bgCard.appendChild(previewWrap);
    const toggleRow = el('div', 'asoul-row');
    toggleRow.appendChild(el('span', 'asoul-row-label', '启用背景图'));
    bgToggle = el('input');
    bgToggle.type = 'checkbox';
    bgToggle.className = 'asoul-check';
    bgToggle.addEventListener('change', () => {
        if (!cfg)
            return;
        cfg.bg.enabled = bgToggle?.checked ?? false;
        void applyAndSave();
    });
    toggleRow.appendChild(bgToggle);
    bgCard.appendChild(toggleRow);
    const alpha = sliderRow(bgCard, '图片透明度', 0, 100, (v) => {
        if (!cfg)
            return;
        cfg.bg.alpha = v / 100;
        applyVisual();
    }, () => { void applyAndSave(); });
    alphaInput = alpha.input;
    alphaValue = alpha.value;
    const base = sliderRow(bgCard, '界面透出强度', 5, 100, (v) => {
        if (!cfg)
            return;
        cfg.bg.baseOpacity = v / 100;
        applyVisual();
    }, () => { void applyAndSave(); });
    baseInput = base.input;
    baseValue = base.value;
    const actions = el('div', 'asoul-actions');
    const fileInput = el('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    const pickBtn = el('button', 'asoul-btn', '选择图片…');
    pickBtn.type = 'button';
    pickBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
        const file = fileInput.files?.[0];
        fileInput.value = '';
        if (!file || !cfg)
            return;
        if (file.size > MAX_IMAGE_BYTES) {
            status(`图片超过 8MB（${(file.size / 1048576).toFixed(1)}MB），请先压缩`, true);
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const url = String(reader.result ?? '');
            if (!url.startsWith('data:image/') || !cfg) {
                status('读取图片失败', true);
                return;
            }
            cfg.bg.image = url;
            cfg.bg.enabled = true;
            void applyAndSave();
        };
        reader.onerror = () => status('读取图片失败', true);
        reader.readAsDataURL(file);
    });
    const defBtn = el('button', 'asoul-btn', '恢复默认图（嘉然）');
    defBtn.type = 'button';
    defBtn.addEventListener('click', () => {
        if (!cfg)
            return;
        cfg.bg.image = '__default__';
        cfg.bg.enabled = true;
        void applyAndSave();
    });
    actions.appendChild(pickBtn);
    actions.appendChild(defBtn);
    bgCard.appendChild(actions);
    bgCard.appendChild(el('p', 'asoul-hint', '默认图来自插件内置 assets/jiaran_1.jpg（原图 9600×5500 已压缩为 2560px）。自选图片以 dataURL 存入 ~/.dsh/plugins/dsh-style-asoul/settings.json（上限 8MB）。'));
    page.appendChild(bgCard);
    /* 一键还原 */
    const resetCard = el('div', 'asoul-card');
    resetCard.appendChild(el('h3', undefined, '还原'));
    const resetBtn = el('button', 'asoul-btn danger', '一键还原到系统原始设置');
    resetBtn.type = 'button';
    resetBtn.addEventListener('click', () => { void doReset(); });
    resetCard.appendChild(resetBtn);
    resetCard.appendChild(el('p', 'asoul-hint', '还原 = 恢复插件启用前的主题偏好（亮色/夜间/跟随系统），主色调与背景全部回到系统原样，并清除已保存的自定义配置。'));
    page.appendChild(resetCard);
    statusLine = el('div', 'asoul-status');
    page.appendChild(statusLine);
    container.appendChild(page);
    sync();
    if (cfg?.bg.enabled && cfg.bg.image === '__default__' && !defaultDataUrl)
        void ensureDefaultImage();
    return () => {
        window.clearTimeout(statusTimer);
        modeBtns = {};
        accentBtns = {};
        bgToggle = null;
        alphaInput = null;
        alphaValue = null;
        baseInput = null;
        baseValue = null;
        previewImg = null;
        previewNone = null;
        statusLine = null;
    };
}
/** settings.section 组件：React 挂载点 + 原生 DOM 内容。 */
function AsoulSettingsPage() {
    const ref = React.useRef(null);
    React.useEffect(() => {
        const node = ref.current;
        if (!node)
            return;
        return mountPanel(node);
    }, []);
    return React.createElement('div', { ref });
}
/* ── 入口 ── */
function apply(ctx) {
    // 背景层 CSS（随插件生命周期清理）
    const style = document.createElement('style');
    style.dataset.plugin = PKG;
    style.textContent = BG_CSS;
    document.head.appendChild(style);
    ctx.effect(() => {
        style.remove();
    }, `${PKG}: background css`);
    // theme 服务探测（可能晚于本插件就绪）
    const maybe = ctx.get('theme');
    if (isThemeService(maybe))
        adoptTheme(maybe);
    else
        watchTheme(ctx);
    // 跟随官方 Appearance 行切换时同步面板显示
    if (typeof ctx.on === 'function') {
        ctx.on('theme/change', (snapshot) => {
            if (snapshot && typeof snapshot.preference === 'string')
                lastPreference = snapshot.preference;
            sync();
        });
    }
    // 设置页注册（settings.section 由官方设置壳声明）
    ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: PKG,
        order: 40,
        label: () => '外观风格',
    }, AsoulSettingsPage));
    void init();
}
async function init() {
    const res = await apiCall('get-config');
    cfg = res?.ok && res.config ? normalizeLocal(res.config) : { ...DEFAULT_CONFIG };
    if (theme)
        adoptTheme(theme);
    else
        applyVisual();
    if (cfg.bg.enabled && cfg.bg.image === '__default__')
        void ensureDefaultImage();
    sync();
}
/* ── 全局背景层 CSS ── */
const BG_CSS = `
html.dsh-style-asoul-bg, html.dsh-style-asoul-bg body {
  background-color: transparent !important;
}
html.dsh-style-asoul-bg body::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -1;
  background-image: var(--dsh-style-asoul-bg-image, none);
  background-size: cover;
  background-position: center;
  opacity: var(--dsh-style-asoul-bg-alpha, 0.3);
  pointer-events: none;
}
`;
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
`;

    return module.exports;
  }
});
