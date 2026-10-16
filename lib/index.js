/**
 * dsh-style-asoul — A-SOUL 外观风格插件（host 半边）
 *
 * 职责：
 *  1. 配置持久化：~/.dsh/plugins/dsh-style-asoul/settings.json
 *  2. webServer API（/dsh-style-asoul/api，POST {method, args}）：
 *     - get-config       读取当前配置（合并默认值）
 *     - set-config       校验并保存配置
 *     - get-default-image 返回内置背景图（assets/jiaran_1.jpg）的 dataURL
 *
 * 运行时零依赖：仅 node 内置模块。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
export const name = 'dsh-style-asoul';
export const inject = ['webServer'];
const PKG = 'dsh-style-asoul';
const CONFIG_DIR = join(homedir(), '.dsh', 'plugins', PKG);
const CONFIG_FILE = join(CONFIG_DIR, 'settings.json');
const ASSET_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
const DEFAULT_IMAGE = 'jiaran_1.jpg';
/** 用户自选图片（dataURL 文本）上限，约 8MB 二进制 */
const MAX_IMAGE_CHARS = 11_000_000;
export const DEFAULT_CONFIG = Object.freeze({
    mode: 'light',
    accent: 'default',
    bg: Object.freeze({ enabled: true, image: '__default__', alpha: 0.3, baseOpacity: 0.6 }),
});
const MODES = ['light', 'dark', 'system'];
const ACCENTS = ['default', 'coffee', 'green', 'bella', 'diana', 'eileen'];
function clamp(n, lo, hi) {
    if (typeof n !== 'number' || Number.isNaN(n))
        return lo;
    return Math.min(hi, Math.max(lo, n));
}
function asRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
}
/** 深校验/合并外部输入到合法配置（防脏数据写入）。 */
export function normalizeConfig(raw) {
    const input = asRecord(raw);
    const bgIn = asRecord(input.bg);
    const mode = MODES.includes(String(input.mode)) ? input.mode : DEFAULT_CONFIG.mode;
    const accent = ACCENTS.includes(String(input.accent)) ? input.accent : DEFAULT_CONFIG.accent;
    const imageRaw = bgIn.image;
    const image = typeof imageRaw === 'string'
        ? (imageRaw === '__default__' || (imageRaw.startsWith('data:image/') && imageRaw.length <= MAX_IMAGE_CHARS)
            ? imageRaw
            : DEFAULT_CONFIG.bg.image)
        : DEFAULT_CONFIG.bg.image;
    const cfg = {
        mode,
        accent,
        bg: {
            enabled: typeof bgIn.enabled === 'boolean' ? bgIn.enabled : DEFAULT_CONFIG.bg.enabled,
            image,
            alpha: clamp(Number(bgIn.alpha ?? DEFAULT_CONFIG.bg.alpha), 0, 1),
            baseOpacity: clamp(Number(bgIn.baseOpacity ?? DEFAULT_CONFIG.bg.baseOpacity), 0.05, 1),
        },
    };
    const orig = input.originalPreference;
    if (typeof orig === 'string' && MODES.includes(orig))
        cfg.originalPreference = orig;
    return cfg;
}
/** 读取配置；文件缺失/损坏时回退默认值。 */
export function readConfig() {
    if (!existsSync(CONFIG_FILE))
        return normalizeConfig(DEFAULT_CONFIG);
    try {
        return normalizeConfig(JSON.parse(readFileSync(CONFIG_FILE, 'utf8')));
    }
    catch {
        return normalizeConfig(DEFAULT_CONFIG);
    }
}
/** 写入配置并返回落盘后的规范化结果。 */
export function writeConfig(raw) {
    const cfg = normalizeConfig(raw);
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
    return cfg;
}
function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.setEncoding('utf8');
        req.on('data', (chunk) => {
            body += chunk;
            if (body.length > MAX_IMAGE_CHARS + 1_000_000) {
                reject(new Error('request body too large'));
            }
        });
        req.on('end', () => resolve(body));
    });
}
function json(res, code, payload) {
    res.writeHead(code, { 'content-type': 'application/json' });
    res.end(JSON.stringify(payload));
}
function mimeOf(file) {
    switch (extname(file).toLowerCase()) {
        case '.png': return 'image/png';
        case '.gif': return 'image/gif';
        case '.webp': return 'image/webp';
        default: return 'image/jpeg';
    }
}
const PET_FILE = join(CONFIG_DIR, 'pet.json');
const PET_EXPORT_DIR = join(CONFIG_DIR, 'exports');
const PET_LIST_KEYS = ['main', 'recent', 'misc'];
const PET_DEFAULTS = {
    lists: { main: [], recent: [], misc: [] },
    pet: { x: null, y: null, panelWidth: 360, opacity: 0.95, enabled: true },
};
function petGenId() {
    return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
function normalizePetItem(raw) {
    const input = asRecord(raw);
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!name)
        return null;
    return {
        id: typeof input.id === 'string' && input.id !== '' ? input.id : petGenId(),
        name: name.slice(0, 200),
        tags: typeof input.tags === 'string' ? input.tags.slice(0, 100) : '',
        priority: typeof input.priority === 'string' ? input.priority.slice(0, 20) : '',
        done: input.done === true,
    };
}
/** 读取桌宠数据；文件缺失/损坏时回退默认。 */
export function readPet() {
    if (!existsSync(PET_FILE))
        return JSON.parse(JSON.stringify(PET_DEFAULTS));
    try {
        const raw = JSON.parse(readFileSync(PET_FILE, 'utf8'));
        const listsIn = asRecord(raw.lists);
        const lists = { main: [], recent: [], misc: [] };
        for (const key of PET_LIST_KEYS) {
            const arr = listsIn[key];
            if (Array.isArray(arr)) {
                for (const item of arr) {
                    const norm = normalizePetItem(item);
                    if (norm)
                        lists[key].push(norm);
                }
            }
        }
        const petIn = asRecord(raw.pet);
        const x = typeof petIn.x === 'number' ? clamp(petIn.x, -2000, 20000) : null;
        const y = typeof petIn.y === 'number' ? clamp(petIn.y, -2000, 20000) : null;
        return {
            lists,
            pet: {
                x,
                y,
                panelWidth: clamp(Number(petIn.panelWidth ?? 360), 280, 520),
                opacity: clamp(Number(petIn.opacity ?? 0.95), 0.3, 1),
                enabled: typeof petIn.enabled === 'boolean' ? petIn.enabled : true,
            },
        };
    }
    catch {
        return JSON.parse(JSON.stringify(PET_DEFAULTS));
    }
}
/** 写入桌宠数据（校验后落盘）。 */
export function writePet(data) {
    const clean = readPet();
    const input = asRecord(data);
    const listsIn = asRecord(input.lists);
    for (const key of PET_LIST_KEYS) {
        const arr = listsIn[key];
        if (Array.isArray(arr)) {
            const next = [];
            for (const item of arr) {
                const norm = normalizePetItem(item);
                if (norm)
                    next.push(norm);
            }
            clean.lists[key] = next;
        }
    }
    const petIn = asRecord(input.pet);
    if (typeof petIn.panelWidth === 'number')
        clean.pet.panelWidth = clamp(petIn.panelWidth, 280, 520);
    if (typeof petIn.opacity === 'number')
        clean.pet.opacity = clamp(petIn.opacity, 0.3, 1);
    if (typeof petIn.enabled === 'boolean')
        clean.pet.enabled = petIn.enabled;
    if (typeof petIn.x === 'number')
        clean.pet.x = clamp(petIn.x, -2000, 20000);
    if (typeof petIn.y === 'number')
        clean.pet.y = clamp(petIn.y, -2000, 20000);
    if (petIn.x === null)
        clean.pet.x = null;
    if (petIn.y === null)
        clean.pet.y = null;
    mkdirSync(CONFIG_DIR, { recursive: true });
    // 写前备份：防止误覆盖丢数据（保留最近一版）
    try {
        if (existsSync(PET_FILE))
            writeFileSync(`${PET_FILE}.bak`, readFileSync(PET_FILE, 'utf8'), 'utf8');
    }
    catch { /* 备份失败不阻塞 */ }
    writeFileSync(PET_FILE, JSON.stringify(clean, null, 2), 'utf8');
    return clean;
}
function allPetNames(data) {
    const names = new Set();
    for (const key of PET_LIST_KEYS) {
        for (const item of data.lists[key])
            names.add(item.name);
    }
    return names;
}
/* ── 桌宠 API 的 base64 传输（dsh-app:// 协议会转坏多字节 UTF-8，纯 ASCII 免疫） ── */
function petEncode(value) {
    return Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
}
function petDecodeArg(args) {
    const b64 = args.b64;
    if (typeof b64 === 'string' && b64 !== '') {
        try {
            const parsed = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
            return parsed;
        }
        catch { /* 解码失败回退到明文 args */ }
    }
    return args;
}
const PET_LIST_LABELS_HOST = { main: '主线任务', recent: '近期任务', misc: '杂事' };
function csvEscapeHost(v) {
    if (/[",\n\r]/.test(v))
        return `"${v.replace(/"/g, '""')}"`;
    return v;
}
/** 宿主侧生成待办 CSV（中文不经过协议层，避免乱码）。 */
function buildTodosCsvHost(data) {
    const lines = ['name,tags,priority,list,done'];
    for (const key of PET_LIST_KEYS) {
        for (const item of data.lists[key]) {
            lines.push([item.name, item.tags, item.priority, PET_LIST_LABELS_HOST[key], item.done ? '1' : '0'].map(csvEscapeHost).join(','));
        }
    }
    return lines.join('\r\n');
}
/**
 * Host 插件主体：注册 /dsh-style-asoul/api 路由。
 * @param ctx - cordis host context（声明 inject: ['webServer']）。
 */
export function apply(ctx) {
    ctx.effect(() => ctx.webServer.register({
        kind: 'prefix',
        path: `/${PKG}/api`,
        handler: async (req, res) => {
            if (req.method !== 'POST') {
                json(res, 405, { ok: false, error: 'method not allowed' });
                return;
            }
            let payload = {};
            try {
                payload = JSON.parse(await readBody(req));
            }
            catch (err) {
                json(res, 400, { ok: false, error: `bad json: ${err instanceof Error ? err.message : String(err)}` });
                return;
            }
            const method = String(payload.method ?? '');
            const args = asRecord(payload.args);
            try {
                switch (method) {
                    case 'get-config': {
                        json(res, 200, { ok: true, config: readConfig() });
                        return;
                    }
                    case 'set-config': {
                        json(res, 200, { ok: true, config: writeConfig(args.config) });
                        return;
                    }
                    case 'reset-config': {
                        rmSync(CONFIG_FILE, { force: true });
                        json(res, 200, { ok: true, config: readConfig() });
                        return;
                    }
                    case 'get-default-image': {
                        const file = join(ASSET_DIR, DEFAULT_IMAGE);
                        if (!existsSync(file)) {
                            json(res, 500, { ok: false, error: `default image asset missing: ${DEFAULT_IMAGE}` });
                            return;
                        }
                        const b64 = readFileSync(file).toString('base64');
                        json(res, 200, { ok: true, dataUrl: `data:${mimeOf(file)};base64,${b64}` });
                        return;
                    }
                    case 'client-report': {
                        // 页面自诊断：client 把实时计算样式快照上报到这里（report.json），供排查渲染断点。
                        const report = args.report;
                        if (typeof report === 'object' && report !== null) {
                            try {
                                mkdirSync(CONFIG_DIR, { recursive: true });
                                writeFileSync(join(CONFIG_DIR, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
                            }
                            catch { /* 诊断落盘失败不阻塞 */ }
                        }
                        json(res, 200, { ok: true });
                        return;
                    }
                    case 'get-pet': {
                        json(res, 200, { ok: true, b64: petEncode(readPet()) });
                        return;
                    }
                    case 'set-pet': {
                        json(res, 200, { ok: true, b64: petEncode(writePet(petDecodeArg(args))) });
                        return;
                    }
                    case 'import-todos': {
                        // 追加导入：先校验条目形状，再按名称全局去重，只追加不覆盖。
                        const input = petDecodeArg(args);
                        const data = readPet();
                        const target = PET_LIST_KEYS.includes(String(input.list)) ? input.list : 'misc';
                        const rows = [];
                        if (Array.isArray(input.items)) {
                            for (const item of input.items) {
                                const norm = normalizePetItem(item);
                                if (norm)
                                    rows.push(norm);
                            }
                        }
                        const existing = allPetNames(data);
                        let added = 0;
                        let skipped = 0;
                        for (const row of rows) {
                            if (existing.has(row.name)) {
                                skipped += 1;
                                continue;
                            }
                            existing.add(row.name);
                            data.lists[target].push(row);
                            added += 1;
                        }
                        mkdirSync(CONFIG_DIR, { recursive: true });
                        writeFileSync(PET_FILE, JSON.stringify(data, null, 2), 'utf8');
                        json(res, 200, { ok: true, added, skipped, total: added + skipped, b64: petEncode(data) });
                        return;
                    }
                    case 'export-todos': {
                        const csv = buildTodosCsvHost(readPet());
                        mkdirSync(PET_EXPORT_DIR, { recursive: true });
                        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                        const file = join(PET_EXPORT_DIR, `todos-${stamp}.csv`);
                        writeFileSync(file, `\uFEFF${csv}`, 'utf8');
                        json(res, 200, { ok: true, path: file });
                        return;
                    }
                    default: {
                        json(res, 400, { ok: false, error: `unknown method: ${method}` });
                        return;
                    }
                }
            }
            catch (err) {
                json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
            }
        },
    }), 'dsh-style-asoul: /dsh-style-asoul/api routes');
}
