import { SUPABASE_URL, SUPABASE_KEY } from './supabase-config.js';
// Anonymous requests only: never forward an author's session to a public page.
export async function publicPosts(filters = {}) {
  const query = new URLSearchParams({select:'id,slug,title,body,published_at',is_published:'eq.true',order:'published_at.desc,id.asc', ...filters});
  const response = await fetch(`${SUPABASE_URL}/rest/v1/private_notes?${query}`, {
    headers: {apikey: SUPABASE_KEY}, cache:'no-store', signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error('Unable to fetch published posts');
  return response.json();
}
