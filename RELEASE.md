# GitHub 发布指南（dsh-style-asoul v0.1.0）

手动发布三步：建仓库 → 推送 → 发 Release。

## 1. 创建 GitHub 仓库

```bash
cd C:\Users\culle\Documents\dshWorkspace\dsh-style-asoul
git init
git add .
git commit -m "dsh-style-asoul v0.1.0: A-SOUL 外观风格插件"

# 方式 A：命令行（需 gh 已登录）
gh repo create dsh-style-asoul --public --source=. --push

# 方式 B：先在 github.com 手动建空仓库（不要勾选 README/.gitignore），然后：
git remote add origin https://github.com/<你的用户名>/dsh-style-asoul.git
git branch -M main
git push -u origin main
```

## 2. 构建发布包（tgz）

```bash
# 需要 node + DSH_CHECKOUT（见 README 构建章节）
set DSH_CHECKOUT=C:\Users\culle\Documents\deepseek-harness
npm run build
npm pack          # 产出 dsh-style-asoul-0.1.0.tgz（files 字段只打包 lib/assets/patch/文档）
```

> 若 `npm pack` 因 bash 缺失跳过 build：构建脚本的三步 tsc 等效命令见 README「构建」章。

## 3. 发布 GitHub Release

```bash
# 方式 A：gh CLI（tag + 附件 + 说明）
gh release create v0.1.0 dsh-style-asoul-0.1.0.tgz \
  --title "dsh-style-asoul v0.1.0" \
  --notes "A-SOUL 外观风格插件：亮色/夜间模式 · 咖啡色/豆沙绿主色调 · 自定义背景图 · 一键还原"

# 方式 B：网页端
#   github.com/<你的用户名>/dsh-style-asoul → Releases → Draft a new release
#   Tag: v0.1.0 → 上传 dsh-style-asoul-0.1.0.tgz → Publish release
```

## 4. 别人如何安装

- DSH 设置 → 插件 → 从 GitHub 安装：`github:<你的用户名>/dsh-style-asoul`
- 或命令行：`dsh plugin add --profile <profile> github:<你的用户名>/dsh-style-asoul`
- 或下载 Release 的 tgz 后：`dsh plugin add --profile <profile> ./dsh-style-asoul-0.1.0.tgz`

（DSH 第三方插件生态即如此装配，参考 `dsh-market`：`github:2BingLing/dsh-market`）

## 发布前自检

- [ ] `package.json` 的 `version` 与 tag 一致（0.1.0 ↔ v0.1.0）
- [ ] `npm run build` 通过，`lib/index.js` 与 `lib/client.js` 已生成
- [ ] `assets/jiaran_1.jpg` 存在（默认背景图；若版权敏感可替换为自己的图）
- [ ] `cordis.patch.yml` 中插件 id/name 为 `dsh-style-asoul`
- [ ] 本机已实测：设置页出现「外观风格」、模式/主色调/背景实时生效、重启后配置保持、一键还原有效
