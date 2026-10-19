import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from '../lib/supabase-config.js';
import { preferencesReady, localizedText, dateText } from '../i18n/client.js';
import { renderMarkdown } from '../lib/markdown.js';
import './theme.js';
import '../styles/markdown.css';

const client = createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (id) => document.getElementById(id);
let offset = 0, busy = false, navRevision = 0;
const pageSize = 12;
const postId = new URLSearchParams(location.search).get('post');
if (postId) $('blogLogin').href = '/login/?next=' + encodeURIComponent('/blog/' + location.search);

async function renderNavigation(session) {
  const request = ++navRevision;
  $('notesLink').hidden = $('adminLink').hidden = true;
  $('blogLogin').hidden = Boolean(session?.user);
  if (!session?.user) return;
  const { data, error } = await client.rpc('get_my_access');
  if (request !== navRevision || error) return;
  const approved = data?.[0]?.status === 'approved';
  $('notesLink').hidden = !approved;
  $('adminLink').hidden = !(approved && data[0].role === 'admin');
  if (!approved) $('blogLogin').hidden = false;
}

async function loadPosts() {
  if (busy) return;
  busy = true; $('blogMore').disabled = true;
  try {
    if (postId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postId)) {
      localizedText($('blogState'), 'blog.notFound'); return;
    }
    let query = client.from('private_notes').select('id,title,body,published_at').eq('is_published', true)
      .order('published_at', { ascending: false }).order('id').range(offset, offset + pageSize);
    if (postId) query = query.eq('id', postId);
    const { data, error } = await query;
    if (error) throw error;
    const posts = data.slice(0, pageSize);
    for (const post of posts) {
      const article = document.createElement('article'); article.className = 'blog-post';
      const heading = document.createElement('h2');
      const link = document.createElement('a'); link.href = '/blog/?post=' + encodeURIComponent(post.id); link.textContent = post.title;
      heading.append(link);
      const time = document.createElement('time'); time.className = 'muted'; time.dateTime = post.published_at;
      time.dataset.localizedDate = ''; time.textContent = dateText(post.published_at);
      const body = document.createElement('div'); body.className = 'markdown-body'; body.innerHTML = renderMarkdown(post.body);
      article.append(time, heading, body); $('blogPosts').append(article);
    }
    offset += posts.length;
    $('blogState').hidden = offset > 0;
    localizedText($('blogState'), postId ? 'blog.notFound' : 'blog.empty');
    $('blogMore').hidden = Boolean(postId) || data.length <= pageSize;
  } catch {
    $('blogState').hidden = false; localizedText($('blogState'), 'blog.error');
    $('blogMore').hidden = false; localizedText($('blogMore'), 'workspace.refresh');
  } finally { busy = false; $('blogMore').disabled = false; }
}
await preferencesReady;
client.auth.onAuthStateChange((_event, session) => { setTimeout(() => renderNavigation(session), 0); });
$('blogMore').addEventListener('click', loadPosts);
loadPosts();
