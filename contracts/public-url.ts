/** Resolve exported same-origin paths beneath a static deployment prefix. */
export function publicAssetUrl(path: string, baseUrl = '/'): string {
  if (/^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith('//')) {
    throw new Error('Recording artifacts must use same-origin paths');
  }
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const relative = path.replace(/^\/+/, '');
  const prefix = base.replace(/^\/+/, '');
  if (prefix && relative.startsWith(prefix)) return `/${relative}`;
  return `${base}${relative}`;
}
