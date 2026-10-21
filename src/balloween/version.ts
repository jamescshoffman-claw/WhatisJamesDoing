// Bump VERSION with each deploy you want players to be able to tell apart. The build time comes from vite.config.js.
declare const __BW_BUILD__: string | undefined

export const VERSION = '1.6'
export const BUILD_TIME: string = typeof __BW_BUILD__ === 'string' ? __BW_BUILD__ : ''

export function buildLabel(): string {
  if (!BUILD_TIME) return `v${VERSION}`
  const d = new Date(BUILD_TIME)
  return `v${VERSION} · deployed ${d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
}
