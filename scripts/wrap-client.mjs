// Wrap the tsc-compiled CJS client into the browser module loader handoff
// expected by dsh-client-modules (same shape tsdown emits for bundle plugins).
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'lib', 'client', 'index.js')
const out = join(root, 'lib', 'client.js')

const body = readFileSync(src, 'utf8')

writeFileSync(out, [
  'window.__ModuleLoader__.load({',
  '  id: "dsh-style-asoul",',
  '  factory: (require) => {',
  '    var module = { exports: {} };',
  '    var exports = module.exports;',
  body,
  '    return module.exports;',
  '  }',
  '});',
  '',
].join('\n'), 'utf8')

rmSync(join(root, 'lib', 'client'), { recursive: true, force: true })
console.log('wrapped client -> lib/client.js')
