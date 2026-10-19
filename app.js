import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
const $ = (id) => document.getElementById(id);
let client, userId = null, revision = 0, editingId = null, authBusy = false;
let access = null, accessRevision = 0, accountsRevision = 0;
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
    access = null; accessRevision++; accountsRevision++;
    $('noteWorkspace').hidden = $('adminPanel').hidden = true;
    $('accounts').replaceChildren();
    $('accessPanel').hidden = false;
    revision++;
    $('notes').replaceChildren();
    resetEditor();
    $('notesState').hidden = false;
    $('notesState').textContent = '正在加载笔记……';
    $('refreshBtn').disabled = false;
  }
  // Database calls must run outside the synchronous auth callback.
  if (userId) setTimeout(loadAccess, 0);
}
function hidePrivateContent() {
  revision++; accountsRevision++;
  $('notes').replaceChildren(); $('accounts').replaceChildren();
  $('noteWorkspace').hidden = $('adminPanel').hidden = true;
  resetEditor();
}
async function loadAccess() {
  if (!userId) return;
  const owner = userId, request = ++accessRevision;
  $('checkAccessBtn').disabled = true;
  try {
    const { data, error } = await client.rpc('get_my_access');
    if (owner !== userId || request !== accessRevision) return;
    if (error) throw error;
    access = data?.[0] ?? null;
    const approved = access?.status === 'approved';
    $('accessPanel').hidden = approved;
    $('noteWorkspace').hidden = !approved;
    $('adminPanel').hidden = !(approved && access.role === 'admin');
    if (!approved) {
      hidePrivateContent();
      const rejected = access?.status === 'rejected';
      $('accessBadge').textContent = rejected ? '未获批准' : '待管理员审批';
      $('accessTitle').textContent = rejected ? '账号申请未获批准' : '申请已提交，请等待批准';
      $('accessDescription').textContent = rejected ? '该账号目前无法使用笔记。如需重新审核，请联系网站管理员。' : '管理员批准你的账号后，即可进入私人笔记空间。你可以稍后刷新审批状态。';
    } else {
      await loadNotes();
      if (access?.role === 'admin' && owner === userId && request === accessRevision) await loadAccounts();
    }
  } catch (error) {
    if (owner !== userId || request !== accessRevision) return;
    access = null; hidePrivateContent(); $('accessPanel').hidden = false;
    $('accessBadge').textContent = '权限检查失败'; $('accessTitle').textContent = '暂时无法确认账号权限';
    $('accessDescription').textContent = '请刷新审批状态后重试。'; message(error.message, true);
  } finally { if (request === accessRevision) $('checkAccessBtn').disabled = false; }
}
async function loadAccounts() {
  if (!userId || access?.role !== 'admin' || access.status !== 'approved') return;
  const owner = userId, request = ++accountsRevision;
  $('refreshAccountsBtn').disabled = true;
  try {
    const { data, error } = await client.rpc('list_accounts');
    if (owner !== userId || request !== accountsRevision) return;
    if (error) throw error;
    $('accounts').replaceChildren(...data.map(accountElement));
    $('accountsState').textContent = `${data.filter((a) => a.status === 'pending').length} 个待审批账号 · 共 ${data.length} 个账号`;
  } catch (error) {
    if (owner !== userId || request !== accountsRevision) return;
    $('accounts').replaceChildren(); $('accountsState').textContent = '无法加载账号，请重试。'; message(error.message, true);
  } finally { if (request === accountsRevision) $('refreshAccountsBtn').disabled = false; }
}
function accountElement(account) {
  const card = document.createElement('article'); card.className = 'account';
  const info = document.createElement('div');
  const email = document.createElement('strong'); email.textContent = account.email || '无邮箱账号';
  const detail = document.createElement('p'); detail.className = 'muted';
  const labels = { pending: '待审批', approved: '已批准', rejected: '已拒绝' };
  detail.textContent = `${account.role === 'admin' ? '管理员' : '普通成员'} · ${labels[account.status]} · ${account.email_confirmed ? '邮箱已验证' : '邮箱待验证'}`;
  info.append(email, detail); card.append(info);
  if (account.role === 'admin') return card;
  const actions = document.createElement('div'); actions.className = 'account-actions';
  for (const [status, label] of [['approved','批准'],['rejected', account.status === 'approved' ? '撤销权限' : '拒绝'],['pending','重新审核']]) {
    if (account.status === status) continue;
    const button = document.createElement('button'); button.type = 'button'; button.className = status === 'approved' ? 'primary compact' : 'secondary compact'; button.textContent = label;
    button.setAttribute('aria-label', `${label}：${account.email || '无邮箱账号'}`);
    button.addEventListener('click', async () => {
      const owner = userId;
      actions.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      try {
        const { error } = await client.rpc('review_account', { target_user_id: account.user_id, new_status: status });
        if (error) throw error;
        if (owner !== userId) return;
        message('审批结果已保存。'); await loadAccounts();
      } catch (error) { if (owner === userId) message(error.message, true); }
      finally { actions.querySelectorAll('button').forEach((b) => { b.disabled = false; }); }
    });
    actions.append(button);
  }
  card.append(actions); return card;
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
  if (!userId || access?.status !== 'approved') return;
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
    message(signup && !data.session ? '请查看邮箱并完成验证，之后登录查看管理员审批状态。' : '已登录，正在确认审批状态。');
  } catch (error) { message(error.message, true); }
  finally { authBusy = false; $('loginBtn').disabled = $('signupBtn').disabled = false; }
}
$('loginForm').addEventListener('submit', (event) => { event.preventDefault(); authenticate(false); });
$('signupBtn').addEventListener('click', () => authenticate(true));
$('cancelBtn').addEventListener('click', resetEditor);
$('refreshBtn').addEventListener('click', loadAccess);
$('checkAccessBtn').addEventListener('click', loadAccess);
$('refreshAccountsBtn').addEventListener('click', loadAccounts);
window.addEventListener('focus', () => { if (userId) loadAccess(); });
setInterval(() => { if (userId && !document.hidden) loadAccess(); }, 30000);
$('noteForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!userId || access?.status !== 'approved' || $('saveBtn').disabled) return;
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
