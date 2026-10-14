#!/bin/bash
# dsh-style-asoul build: compile host (ESM) + client (CJS, wrapped for the
# browser module loader) with the dsh checkout's typescript.
# 插件运行时零依赖；编译期也零依赖（node 内置模块用 src/node-shims.d.ts
# 声明），因此不需要任何 junction / npm install，只要 node + checkout。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# DSH_CHECKOUT 探测：环境变量 → 常见路径（含 Documents/deepseek-harness）
CHECKOUT="${DSH_CHECKOUT:-}"
if [ -z "$CHECKOUT" ]; then
  for candidate in \
    "$HOME/Documents/deepseek-harness" \
    "$HOME/deepseek-harness" \
    "$HOME/dsh-harness" \
    "$HOME/dsh" \
    "$HOME/.dsh/dsh-harness"; do
    if [ -d "$candidate/packages" ]; then CHECKOUT="$candidate"; break; fi
  done
fi
if [ -z "$CHECKOUT" ] || [ ! -d "$CHECKOUT/packages" ]; then
  echo "build: cannot locate the dsh checkout (set DSH_CHECKOUT)" >&2
  exit 1
fi

TS_JS="$CHECKOUT/node_modules/typescript/lib/tsc.js"
if [ ! -f "$TS_JS" ]; then
  echo "build: tsc.js not found at $TS_JS" >&2
  exit 1
fi

echo "=== Compiling host (src/index.ts -> lib/index.js) [checkout: $CHECKOUT] ==="
node "$TS_JS" -p tsconfig.host.json

echo "=== Compiling client (src/client/index.ts -> lib/client/index.js) ==="
node "$TS_JS" -p tsconfig.client.json

echo "=== Wrapping client into window.__ModuleLoader__ ==="
node scripts/wrap-client.mjs

echo "=== Build complete ==="
ls -la lib lib/client 2>/dev/null || true
