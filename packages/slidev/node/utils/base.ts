export function normalizeBase(base?: string): string {
  if (!base || typeof base !== 'string' || base.trim() === '' || base === '//')
    return '/'
  // Remove leading/trailing spaces and slashes, then add single leading/trailing slash
  const cleaned = base.trim().replace(/^\/+/g, '').replace(/\/+$/g, '')
  if (!cleaned)
    return '/'
  return `/${cleaned}/`.replace(/\/+/g, '/')
}
