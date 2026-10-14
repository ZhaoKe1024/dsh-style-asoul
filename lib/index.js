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
const ACCENTS = ['default', 'coffee', 'green'];
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
