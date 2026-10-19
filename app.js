import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
const $ = (id) => document.getElementById(id);
let client, userId = null, revision = 0, editingId = null, authBusy = false;
function message(text, error = false) {
  $('message').textContent = text;
  $('message').classList.toggle('error', error);
}
function resetEditor() {
  editingId = null;
  $('noteForm').reset();
  $('editorTitle').textContent = '写一条新笔记';
  $('cancelBtn').hidden = true;
}
function renderSession(session) {
  const nextId = session?.user?.id ?? null;
  const changed = nextId !== userId;
  userId = nextId;
  $('auth').hidden = Boolean(userId);
  $('dashboard').hidden = !userId;
  $('welcome').textContent = session?.user?.email ?? '';
  if (changed || !userId) {
    revision++;
    $('notes').replaceChildren();
    resetEditor();
    $('notesState').hidden = false;
    $('notesState').textContent = '正在加载笔记……';
    $('refreshBtn').disabled = false;
  }
  // Database calls must run outside the synchronous auth callback.
  if (changed && userId) setTimeout(loadNotes, 0);
}
function noteElement(note) {
  const article = document.createElement('article'); article.className = 'note';
  const title = document.createElement('h3'); title.textContent = note.title;
  const body = document.createElement('p'); body.className = 'note-body'; body.textContent = note.body;
  const meta = document.createElement('div'); meta.className = 'note-meta';
  const time = document.createElement('time'); time.dateTime = note.created_at;
  time.textContent = new Date(note.created_at).toLocaleString('zh-CN');
  const actions = document.createElement('div'); actions.className = 'note-actions';
  const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = '编辑';
  edit.setAttribute('aria-label', `编辑：${note.title}`);
  edit.addEventListener('click', () => {
    editingId = note.id; $('noteTitle').value = note.title; $('noteBody').value = note.body;
    $('editorTitle').textContent = '编辑笔记'; $('cancelBtn').hidden = false; $('noteTitle').focus();
  });
  const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'delete'; remove.textContent = '删除';
  remove.setAttribute('aria-label', `删除：${note.title}`);
  remove.addEventListener('click', async () => {
    if (!confirm(`删除“${note.title}”？此操作无法撤销。`)) return;
    const owner = userId; remove.disabled = true;
    try {
      const { data, error } = await client.from('private_notes').delete().eq('id', note.id).eq('user_id', owner).select('id');
      if (error) throw error;
      if (!data.length) throw new Error('笔记已不存在，请刷新后重试。');
      if (owner !== userId) return;
      if (editingId === note.id) resetEditor();
      message('笔记已删除。'); await loadNotes();
    } catch (error) { if (owner === userId) message(error.message, true); }
    finally { remove.disabled = false; }
  });
  actions.append(edit, remove); meta.append(time, actions); article.append(title, body, meta); return article;
}
async function loadNotes() {
  if (!userId) return;
  const owner = userId, request = ++revision;
  $('refreshBtn').disabled = true;
  try {
    const { data, error } = await client.from('private_notes').select('id,title,body,created_at').eq('user_id', owner).order('created_at', { ascending: false });
    if (owner !== userId || request !== revision) return;
    if (error) throw error;
    $('notes').replaceChildren(...data.map(noteElement));
    $('notesState').hidden = data.length > 0; $('notesState').textContent = '还没有笔记。写下第一个想法吧。';
  } catch (error) {
    if (owner !== userId || request !== revision) return;
    $('notesState').hidden = false; $('notesState').textContent = '暂时无法加载笔记，请点击刷新重试。';
    message(error.message, true);
  } finally { if (request === revision) $('refreshBtn').disabled = false; }
}
async function authenticate(signup) {
  if (!client || authBusy || !$('loginForm').reportValidity()) return;
  const password = $('password').value;
  if (signup && password.length < 8) { message('注册密码至少需要 8 位。', true); return; }
  authBusy = true; $('loginBtn').disabled = $('signupBtn').disabled = true;
  message(signup ? '正在创建账号……' : '正在登录……');
  try {
    const credentials = { email: $('email').value.trim(), password };
    const { data, error } = signup
      ? await client.auth.signUp({ ...credentials, options: { emailRedirectTo: new URL('./', location.href).href } })
      : await client.auth.signInWithPassword(credentials);
    if (error) throw error;
    $('password').value = '';
    message(signup && !data.session ? '请查看邮箱，点击验证链接完成注册，然后返回登录。' : '已登录，你的笔记准备好了。');
  } catch (error) { message(error.message, true); }
  finally { authBusy = false; $('loginBtn').disabled = $('signupBtn').disabled = false; }
}
$('loginForm').addEventListener('submit', (event) => { event.preventDefault(); authenticate(false); });
$('signupBtn').addEventListener('click', () => authenticate(true));
$('cancelBtn').addEventListener('click', resetEditor);
$('refreshBtn').addEventListener('click', loadNotes);
$('noteForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!userId || $('saveBtn').disabled) return;
  const owner = userId, title = $('noteTitle').value.trim();
  if (!title) { message('请输入笔记标题。', true); return; }
  const values = { title, body: $('noteBody').value };
  $('saveBtn').disabled = $('cancelBtn').disabled = true;
  try {
    const query = editingId
      ? client.from('private_notes').update(values).eq('id', editingId).eq('user_id', owner)
      : client.from('private_notes').insert({ ...values, user_id: owner });
    const { data, error } = await query.select('id');
    if (error) throw error;
    if (!data.length) throw new Error('保存失败，请刷新后重试。');
    if (owner !== userId) return;
    resetEditor(); message('笔记已保存。'); await loadNotes();
  } catch (error) { if (owner === userId) message(error.message, true); }
  finally { $('saveBtn').disabled = $('cancelBtn').disabled = false; }
});
$('logoutBtn').addEventListener('click', async () => {
  if (!client) return;
  $('logoutBtn').disabled = true;
  try {
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) throw error;
    renderSession(null); message('已退出登录。');
  } catch (error) { message(error.message, true); }
  finally { $('logoutBtn').disabled = false; }
});
try {
  $('loginBtn').disabled = $('signupBtn').disabled = true;
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.102.0/+esm');
  client = createClient(SUPABASE_URL, SUPABASE_KEY);
  client.auth.onAuthStateChange((_event, session) => renderSession(session));
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  renderSession(data.session);
  $('loginBtn').disabled = $('signupBtn').disabled = false;
} catch (error) { message(`无法连接登录服务，请刷新重试。${error.message}`, true); }
