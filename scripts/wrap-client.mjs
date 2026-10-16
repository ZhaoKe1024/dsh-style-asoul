// Wrap the tsc-compiled CJS client into the browser module loader handoff
// expected by dsh-client-modules (same shape tsdown emits for bundle plugins).
// Also embeds the default wallpaper as a data URL so the dsh-app:// page
// never has to fetch a large payload through its custom protocol.
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'lib', 'client', 'index.js')
const out = join(root, 'lib', 'client.js')
const img = join(root, 'assets', 'jiaran_1.jpg')

let body = readFileSync(src, 'utf8')

// Embed the default wallpaper (placeholder replacement in the CJS emit).
try {
  const dataUrl = 'data:image/jpeg;base64,' + readFileSync(img).toString('base64')
  const match = body.match(/['"]__DSH_ASOUL_EMBED__['"]/)
  if (!match) {
    throw new Error('placeholder marker not found in compiled client')
  }
  body = body.replace(match[0], JSON.stringify(dataUrl))
  console.log(`embedded default wallpaper (${dataUrl.length} chars)`)
} catch (err) {
  console.warn('wallpaper embed skipped:', err && err.message)
}

// Embed the desktop pet photo (嘉然桌宠形象).
try {
  const petImg = join(root, 'assets', 'jiaran_desktop-photo.png')
  const petDataUrl = 'data:image/png;base64,' + readFileSync(petImg).toString('base64')
  const petMatch = body.match(/['"]__DSH_ASOUL_PET_EMBED__['"]/)
  if (!petMatch) {
    throw new Error('pet placeholder marker not found in compiled client')
  }
  body = body.replace(petMatch[0], JSON.stringify(petDataUrl))
  console.log(`embedded desktop pet photo (${petDataUrl.length} chars)`)
} catch (err) {
  console.warn('pet photo embed skipped:', err && err.message)
}

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
