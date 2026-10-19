import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from '../lib/supabase-config.js';
import { t, preferencesReady, localizedText, localizedAttribute, dateText } from '../i18n/client.js';
import './theme.js';
import { renderMarkdown, MAX_NOTE_LENGTH } from '../lib/markdown.js';
import { ensureMarkdownEditor, markdownValue, setMarkdownValue } from './markdown-editor.js';
const $ = (id) => document.getElementById(id);
let client, userId = null, revision = 0, editingId = null, authBusy = false;
let access = null, accessRevision = 0, accountsRevision = 0;
let activeTab = 'notes';
function renderWorkspaceTabs(nextTab = activeTab) {
  const approved = Boolean(userId && access?.status === 'approved');
  const isAdmin = approved && access.role === 'admin';
  activeTab = isAdmin && nextTab === 'admin' ? 'admin' : 'notes';
  $('workspaceTabs').hidden = !approved;
  $('adminTab').hidden = !isAdmin;
  $('noteWorkspace').hidden = !approved || activeTab !== 'notes';
  $('adminPanel').hidden = !isAdmin || activeTab !== 'admin';
  for (const name of ['notes', 'admin']) {
    const selected = name === activeTab;
    $(name + 'Tab').setAttribute('aria-selected', String(selected));
    $(name + 'Tab').tabIndex = selected ? 0 : -1;
  }
  if (!isAdmin) {
    accountsRevision++;
    $('accounts').replaceChildren();
    $('accountsState').textContent = '';
  }
}
async function selectWorkspaceTab(name) {
  renderWorkspaceTabs(name);
  if (!userId || access?.status !== 'approved') return;
  if (activeTab === 'admin') await loadAccounts();
  else {
    try { await ensureMarkdownEditor(); } catch (error) { showError(error); }
  }
}
function message(key, error = false, options = {}) {
  localizedText($('message'), key, options);
  $('message').classList.toggle('error', error);
}
function showError(error) {
  const errors = {
    invalid_credentials: 'error.invalidCredentials',
    email_not_confirmed: 'error.emailNotConfirmed',
    signup_disabled: 'error.signupDisabled',
    over_email_send_rate_limit: 'error.rateLimit',
    over_request_rate_limit: 'error.rateLimit',
    weak_password: 'error.weakPassword',
    user_already_exists: 'error.existingUser',
    '42501': 'error.forbidden',
  };
  message(error.translationKey || errors[error.code] || 'error.unexpected', true, { details: error.message || String(error) });
}
function translatedError(key) {
  return Object.assign(new Error(t(key)), { translationKey: key });
}
function resetEditor() {
  editingId = null;
  $('noteForm').reset();
  setMarkdownValue('');
  localizedText($('editorTitle'), 'workspace.newNote');
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
    renderWorkspaceTabs('notes');
    $('accounts').replaceChildren();
    $('accessPanel').hidden = false;
    revision++;
    $('notes').replaceChildren();
    resetEditor();
    $('notesState').hidden = false;
    localizedText($('notesState'), 'workspace.loading');
    $('refreshBtn').disabled = false;
  }
  // Database calls must run outside the synchronous auth callback.
  if (userId) setTimeout(loadAccess, 0);
}
function hidePrivateContent() {
  revision++; accountsRevision++;
  $('notes').replaceChildren(); $('accounts').replaceChildren();
  renderWorkspaceTabs('notes');
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
    renderWorkspaceTabs();
    if (!approved) {
      hidePrivateContent();
      const rejected = access?.status === 'rejected';
      localizedText($('accessBadge'), rejected ? 'access.rejectedBadge' : 'access.pendingBadge');
      localizedText($('accessTitle'), rejected ? 'access.rejectedTitle' : 'access.pendingTitle');
      localizedText($('accessDescription'), rejected ? 'access.rejectedDescription' : 'access.pendingDescription');
    } else {
      await ensureMarkdownEditor();
      if (owner !== userId || request !== accessRevision) return;
      await loadNotes();
      if (activeTab === 'admin' && access?.role === 'admin' && owner === userId && request === accessRevision) await loadAccounts();
    }
  } catch (error) {
    if (owner !== userId || request !== accessRevision) return;
    access = null; hidePrivateContent(); $('accessPanel').hidden = false;
    localizedText($('accessBadge'), 'access.errorBadge'); localizedText($('accessTitle'), 'access.errorTitle');
    localizedText($('accessDescription'), 'access.errorDescription'); showError(error);
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
    localizedText($('accountsState'), 'admin.summary', { count: data.filter((a) => a.status === 'pending').length, total: data.length });
  } catch (error) {
    if (owner !== userId || request !== accountsRevision) return;
    $('accounts').replaceChildren(); localizedText($('accountsState'), 'admin.loadError'); showError(error);
  } finally { if (request === accountsRevision) $('refreshAccountsBtn').disabled = false; }
}
function accountElement(account) {
  const card = document.createElement('article'); card.className = 'account';
  const info = document.createElement('div');
  const email = document.createElement('strong');
  if (account.email) email.textContent = account.email; else localizedText(email, 'admin.noEmail');
  const detail = document.createElement('p'); detail.className = 'muted';
  localizedText(detail, 'admin.detail', { $labels: {
    role: account.role === 'admin' ? 'admin.adminRole' : 'admin.memberRole',
    status: `admin.${account.status}`,
    verification: account.email_confirmed ? 'admin.emailVerified' : 'admin.emailPending',
  } });
  info.append(email, detail); card.append(info);
  if (account.role === 'admin') return card;
  const actions = document.createElement('div'); actions.className = 'account-actions';
  for (const [status, labelKey] of [['approved','admin.approve'],['rejected', account.status === 'approved' ? 'admin.revoke' : 'admin.reject'],['pending','admin.review']]) {
    if (account.status === status) continue;
    const button = document.createElement('button'); button.type = 'button'; button.className = status === 'approved' ? 'primary compact' : 'secondary compact';
    localizedText(button, labelKey);
    localizedAttribute(button, 'aria-label', 'admin.actionLabel', { email: account.email || '', $labels: { action: labelKey, ...(!account.email ? { email: 'admin.noEmail' } : {}) } });
    button.addEventListener('click', async () => {
      const owner = userId;
      actions.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      try {
        const { error } = await client.rpc('review_account', { target_user_id: account.user_id, new_status: status });
        if (error) throw error;
        if (owner !== userId) return;
        message('admin.saved'); await loadAccounts();
      } catch (error) { if (owner === userId) showError(error); }
      finally { actions.querySelectorAll('button').forEach((b) => { b.disabled = false; }); }
    });
    actions.append(button);
  }
  card.append(actions); return card;
}
function noteElement(note) {
  const article = document.createElement('article'); article.className = 'note';
  const title = document.createElement('h3'); title.textContent = note.title;
  const body = document.createElement('div'); body.className = 'note-body markdown-body'; body.innerHTML = renderMarkdown(note.body);
  const meta = document.createElement('div'); meta.className = 'note-meta';
  const time = document.createElement('time'); time.dateTime = note.created_at;
  time.dataset.localizedDate = '';
  time.textContent = dateText(note.created_at);
  const actions = document.createElement('div'); actions.className = 'note-actions';
  const edit = document.createElement('button'); edit.type = 'button'; localizedText(edit, 'workspace.edit');
  localizedAttribute(edit, 'aria-label', 'workspace.editLabel', { title: note.title });
  edit.addEventListener('click', () => {
    editingId = note.id; $('noteTitle').value = note.title; setMarkdownValue(note.body);
    localizedText($('editorTitle'), 'workspace.editNote'); $('cancelBtn').hidden = false; $('noteTitle').focus();
  });
  const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'delete'; localizedText(remove, 'workspace.delete');
  localizedAttribute(remove, 'aria-label', 'workspace.deleteLabel', { title: note.title });
  remove.addEventListener('click', async () => {
    if (!confirm(t('workspace.deleteConfirm', { title: note.title }))) return;
    const owner = userId; remove.disabled = true;
    try {
      const { data, error } = await client.from('private_notes').delete().eq('id', note.id).eq('user_id', owner).select('id');
      if (error) throw error;
      if (!data.length) throw translatedError('workspace.missing');
      if (owner !== userId) return;
      if (editingId === note.id) resetEditor();
      message('workspace.deleted'); await loadNotes();
    } catch (error) { if (owner === userId) showError(error); }
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
    $('notesState').hidden = data.length > 0; localizedText($('notesState'), 'workspace.empty');
  } catch (error) {
    if (owner !== userId || request !== revision) return;
    $('notesState').hidden = false; localizedText($('notesState'), 'workspace.loadError');
    showError(error);
  } finally { if (request === revision) $('refreshBtn').disabled = false; }
}
async function authenticate(signup) {
  if (!client || authBusy || !$('loginForm').reportValidity()) return;
  const password = $('password').value;
  if (signup && password.length < 8) { message('auth.passwordShort', true); return; }
  authBusy = true; $('loginBtn').disabled = $('signupBtn').disabled = true;
  message(signup ? 'auth.signingUp' : 'auth.signingIn');
  try {
    const credentials = { email: $('email').value.trim(), password };
    const { data, error } = signup
      ? await client.auth.signUp({ ...credentials, options: { emailRedirectTo: new URL('./', location.href).href } })
      : await client.auth.signInWithPassword(credentials);
    if (error) throw error;
    $('password').value = '';
    message(signup && !data.session ? 'auth.verifyEmail' : 'auth.signedIn');
  } catch (error) { showError(error); }
  finally { authBusy = false; $('loginBtn').disabled = $('signupBtn').disabled = false; }
}
$('loginForm').addEventListener('submit', (event) => { event.preventDefault(); authenticate(false); });
$('signupBtn').addEventListener('click', () => authenticate(true));
$('cancelBtn').addEventListener('click', resetEditor);
$('refreshBtn').addEventListener('click', loadAccess);
$('checkAccessBtn').addEventListener('click', loadAccess);
$('refreshAccountsBtn').addEventListener('click', loadAccounts);
for (const name of ['notes', 'admin']) {
  const tab = $(name + 'Tab');
  tab.addEventListener('click', () => selectWorkspaceTab(name));
  tab.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const names = $('adminTab').hidden ? ['notes'] : ['notes', 'admin'];
    const next = event.key === 'Home' ? names[0] : event.key === 'End' ? names.at(-1) : names[(names.indexOf(name) + 1) % names.length];
    selectWorkspaceTab(next);
    $(next + 'Tab').focus();
  });
}
window.addEventListener('focus', () => { if (userId) loadAccess(); });
setInterval(() => { if (userId && !document.hidden) loadAccess(); }, 30000);
$('noteForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!userId || access?.status !== 'approved' || $('saveBtn').disabled) return;
  const owner = userId, title = $('noteTitle').value.trim();
  if (!title) { message('workspace.titleRequired', true); return; }
  const body = markdownValue();
  if (body.length > MAX_NOTE_LENGTH) { message('markdown.tooLong', true, { total: MAX_NOTE_LENGTH }); return; }
  const values = { title, body };
  $('saveBtn').disabled = $('cancelBtn').disabled = true;
  try {
    const query = editingId
      ? client.from('private_notes').update(values).eq('id', editingId).eq('user_id', owner)
      : client.from('private_notes').insert({ ...values, user_id: owner });
    const { data, error } = await query.select('id');
    if (error) throw error;
    if (!data.length) throw translatedError('workspace.saveError');
    if (owner !== userId) return;
    resetEditor(); message('workspace.saved'); await loadNotes();
  } catch (error) { if (owner === userId) showError(error); }
  finally { $('saveBtn').disabled = $('cancelBtn').disabled = false; }
});
$('logoutBtn').addEventListener('click', async () => {
  if (!client) return;
  $('logoutBtn').disabled = true;
  try {
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) throw error;
    renderSession(null); message('auth.signedOut');
  } catch (error) { showError(error); }
  finally { $('logoutBtn').disabled = false; }
});
async function initialize() {
  try {
    $('loginBtn').disabled = $('signupBtn').disabled = true;
    await preferencesReady;
    client = createClient(SUPABASE_URL, SUPABASE_KEY);
    client.auth.onAuthStateChange((_event, session) => renderSession(session));
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    renderSession(data.session);
    $('loginBtn').disabled = $('signupBtn').disabled = false;
  } catch (error) { message('error.connection', true, { details: error.message || String(error) }); }
}
initialize();
