import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from '../lib/supabase-config.js';
import { preferencesReady } from '../i18n/client.js';
import { renderMarkdown } from '../lib/markdown.js';
import './theme.js';
import '../styles/markdown.css';
const client = createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = id => document.getElementById(id);
let navRevision = 0;
$('blogLogin').href = '/login/?next=' + encodeURIComponent(location.pathname + location.search);
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
await preferencesReady;
const body = $('postBody');
if (body) { body.innerHTML = renderMarkdown(body.dataset.markdown); delete body.dataset.markdown; }
client.auth.onAuthStateChange((_event, session) => { setTimeout(() => renderNavigation(session), 0); });
