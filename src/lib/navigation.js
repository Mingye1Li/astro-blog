// Only application pages may be used as post-login destinations.
export function safeReturnPath(value, origin) {
  try {
    const url = new URL(value || '/notes/', origin);
    if (url.origin !== origin || url.username || url.password) return '/notes/';
    const path = url.pathname.replace(/\/$/, '');
    if (!['/notes', '/admin'].includes(path)) return '/notes/';
    return `${path}/${url.search}${url.hash}`;
  } catch { return '/notes/'; }
}

export function loginPath(location) {
  if (!['/notes', '/admin'].includes(location.pathname.replace(/\/$/, ''))) return '/login/';
  const next = safeReturnPath(location.pathname + location.search + location.hash, location.origin);
  return '/login/?next=' + encodeURIComponent(next);
}

export function destinationAfterLogin(search, origin, role) {
  const next = safeReturnPath(new URLSearchParams(search).get('next'), origin);
  return next.startsWith('/admin/') && role !== 'admin' ? '/notes/' : next;
}
