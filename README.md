# dsh-style-asoul

A-SOUL 外观风格插件（v0.1）——给 DeepSeek Harness 换一套你喜欢的外观：亮色基调 + 可选夜间模式，主色调可选咖啡色 / 豆沙绿，支持自定义背景图（默认嘉然壁纸，透明度 0.3），带设置面板、持久化与一键还原。

适用于 **DSH desktop（桌面端）** 与 **webui（网页端）**。

效果：
![](./assets/demo.png)

## 功能

| 功能 | 说明 |
| --- | --- |
| 模式 | 亮色（默认）/ 夜间 / 跟随系统 |
| 主色调 | 默认（当前 DeepSeek 蓝，不变）/ 咖啡色 / 豆沙绿——只替换主色相关 token（链接、激活态、按钮、气泡），明暗两套配色齐备 |
| 背景图 | 内置嘉然壁纸（assets/jiaran_1.jpg，由 9600×5500 原图压缩为 2560px），来源[bilibili](https://www.bilibili.com/opus/1258687238954287128)；可自选任意图片（≤8MB）；图片透明度默认 **0.3**、可调；"界面透出强度"控制界面底色让背景透出的程度 |
| 设置面板 | 设置 → 「外观风格」页：所有选项可视化调节，实时生效 |
| 持久化 | 配置存于 `~/.dsh/plugins/dsh-style-asoul/settings.json`（经 host API，desktop/webui 通用） |
| 一键还原 | 一键恢复插件启用前的主题偏好、主色调与背景，并清除自定义配置 |

## 安装

**方式一（推荐）：插件管理 UI**
设置 → 插件 → 从 GitHub 安装：`github:<你的用户名>/dsh-style-asoul`

**方式二：命令行**
```bash
dsh plugin add --profile <你的 profile> github:<你的用户名>/dsh-style-asoul
```

**方式三：本地 tgz**
```bash
dsh plugin add --profile <你的 profile> ./dsh-style-asoul-0.1.0.tgz
```

**方式四（开发模式）：本地目录链接**
在 profile 的 `package.json` 中声明：
```json
"dependencies": { "dsh-style-asoul": "link:C:/path/to/dsh-style-asoul" },
"dsh": { "profile": { "bundles": ["...", "dsh-style-asoul"] } }
```

## 使用

1. 打开 设置 → **外观风格**。
2. 选择 模式 / 主色调，拖动 背景图 透明度与透出强度，点击「选择图片…」换壁纸，或「恢复默认图（嘉然）」。
3. 「一键还原到系统原始设置」= 完全回到插件安装前的状态（含主题偏好）。
4. 所有修改即时生效并自动保存；重启后自动恢复。

## 持久化与还原语义

- 配置文件：`~/.dsh/plugins/dsh-style-asoul/settings.json`
- 插件首次生效时会把当时的系统主题偏好记入 `originalPreference`——「一键还原」即恢复该值（同时清掉主色调/背景/自选图）。
- 卸载插件前建议先点「一键还原」，再在插件管理里卸载，即可不留任何痕迹。

## 目录结构（src 文件位置）

```
dsh-style-asoul/
├── package.json            # 插件元数据 + dsh.bundle / dsh.client 声明 + exports
├── cordis.patch.yml        # bundle 装配 patch（insert 插件行）
├── tsconfig.host.json      # host 编译配置（ESM，零依赖，node 内置类型自声明）
├── tsconfig.client.json    # client 编译配置（CJS，DOM lib）
├── scripts/
│   ├── build.sh            # 构建脚本（自动探测 DSH_CHECKOUT → tsc 编译 host+client）
│   └── wrap-client.mjs     # 把 client CJS 产物包成 window.__ModuleLoader__ 格式
├── src/
│   ├── index.ts            # host 半边：/dsh-style-asoul/api 路由 + settings.json 读写 + 默认图 dataURL
│   ├── node-shims.d.ts     # 用到的 node 内置模块最小类型声明（免 @types/node）
│   └── client/
│       └── index.ts        # client 半边：外观设置页 + 主题/主色调/背景应用引擎 + 一键还原
├── assets/
│   └── jiaran_1.jpg        # 内置默认背景图（2560px，由 9600×5500 原图压缩）
├── lib/                    # 构建产物（index.js = host；client.js = 浏览器端）
├── README.md
└── RELEASE.md              # GitHub 发布步骤
```

## 构建

零运行时依赖、零编译期外部依赖（node 内置模块类型自声明），只需 node + 一个 DSH 源码 checkout：

```bash
# 设置 DSH 源码 checkout（构建脚本也会自动探测常见路径，含 ~/Documents/deepseek-harness）
export DSH_CHECKOUT=/path/to/deepseek-harness   # Windows: set DSH_CHECKOUT=...

npm run build          # bash scripts/build.sh：tsc 编译 host + client + 包装
# 产物：lib/index.js（host）、lib/client.js（浏览器）
```

> 若没有 bash，等效的 PowerShell 构建：用 checkout 里的 `node_modules/typescript/lib/tsc.js` 依次执行
> `node tsc.js -p tsconfig.host.json`、`node tsc.js -p tsconfig.client.json`、`node scripts/wrap-client.mjs`。

## 技术说明

- 主题完全走官方 theme 服务：模式 = `theme.setTheme`（持久化进官方 Appearance 设置）；主色调/背景透出 = `theme.overrideTokens`（{light, dark} 分层覆盖，卸载即还原）；背景图 = `body::before` 固定层 + `--dsw-alias-bg-base` 半透明化。
- 面板 UI 全部使用官方 token（`--dsw-alias-*`），自动跟随明暗模式与主色调，无硬编码颜色。
- 与官方「外观」设置共存：官方行切换 light/dark 时本插件面板同步显示，两套入口互不冲突。

## License

MIT
