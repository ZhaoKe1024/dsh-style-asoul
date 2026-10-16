/**
 * 最小 node 内置模块类型声明（仅覆盖本插件用到的 API）。
 * 免去 @types/node 依赖，构建零 junction、零网络。
 */
interface ImportMeta {
  url: string
}

interface NodeJsBuffer {
  toString(encoding: string): string
}

declare const Buffer: {
  from(data: string, encoding: string): NodeJsBuffer
}

declare module 'node:fs' {
  interface NodeBuffer {
    toString(encoding: string): string
  }
  export function readFileSync(path: string): NodeBuffer
  export function readFileSync(path: string, encoding: string): string
  export function writeFileSync(path: string, data: string, encoding?: string): void
  export function existsSync(path: string): boolean
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void
  export function rmSync(path: string, options?: { force?: boolean }): void
}

declare module 'node:path' {
  export function join(...parts: string[]): string
  export function dirname(path: string): string
  export function extname(path: string): string
}

declare module 'node:os' {
  export function homedir(): string
}

declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string
}
