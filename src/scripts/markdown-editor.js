import { i18n, t, localizedText, localizedAttribute } from '../i18n/client.js';
import { renderMarkdown, MAX_NOTE_LENGTH } from '../lib/markdown.js';
import 'easymde/dist/easymde.min.css';
import '../styles/markdown.css';

let editor;
let loading;

function updateLabels() {
  if (!editor) return;
  editor.codemirror.setOption('placeholder', t('workspace.bodyPlaceholder'));
  localizedAttribute(editor.codemirror.getInputField(), 'aria-label', 'markdown.label');
  for (const [name, key] of Object.entries(toolbarKeys)) {
    const button = editor.toolbarElements[name];
    if (!button) continue;
    localizedAttribute(button, 'title', key);
    localizedAttribute(button, 'aria-label', key);
    button.tabIndex = 0;
  }
  updateCount();
}
function updateCount() {
  const count = markdownValue().length;
  localizedText(document.getElementById('noteLength'), 'markdown.characters', { count, total: MAX_NOTE_LENGTH });
  document.getElementById('noteLength').classList.toggle('error', count > MAX_NOTE_LENGTH);
}
const toolbarKeys = {
  bold: 'markdown.bold', italic: 'markdown.italic', heading: 'markdown.heading',
  quote: 'markdown.quote', 'unordered-list': 'markdown.bullets', 'ordered-list': 'markdown.numbered',
  code: 'markdown.code', link: 'markdown.link', table: 'markdown.table',
  undo: 'markdown.undo', redo: 'markdown.redo', preview: 'markdown.preview',
};

export async function ensureMarkdownEditor() {
  if (editor) { editor.codemirror.refresh(); return; }
  if (!loading) {
    loading = import('easymde').then(({ default: EasyMDE }) => {
      const toolbar = [
        ['bold', EasyMDE.toggleBold, 'B'], ['italic', EasyMDE.toggleItalic, 'I'],
        ['heading', EasyMDE.toggleHeadingSmaller, 'H'], '|',
        ['quote', EasyMDE.toggleBlockquote, '❝'], ['unordered-list', EasyMDE.toggleUnorderedList, '•'],
        ['ordered-list', EasyMDE.toggleOrderedList, '1.'], ['code', EasyMDE.toggleCodeBlock, '</>'],
        ['link', EasyMDE.drawLink, '↗'], ['table', EasyMDE.drawTable, '▦'], '|',
        ['undo', EasyMDE.undo, '↶'], ['redo', EasyMDE.redo, '↷'],
        ['preview', EasyMDE.togglePreview, '◉'],
      ].map((item) => typeof item === 'string' ? item : {
        name: item[0], action: item[1], text: item[2], title: t(toolbarKeys[item[0]]),
        className: 'markdown-tool', noDisable: item[0] === 'preview',
      });
      editor = new EasyMDE({
        element: document.getElementById('noteBody'),
        toolbar,
        autoDownloadFontAwesome: false,
        spellChecker: false,
        autosave: { enabled: false },
        forceSync: true,
        status: false,
        inputStyle: 'contenteditable',
        minHeight: '250px',
        placeholder: t('workspace.bodyPlaceholder'),
        previewClass: ['editor-preview', 'markdown-body'],
        previewRender: renderMarkdown,
        shortcuts: { toggleSideBySide: null, toggleFullScreen: null, togglePreview: 'Cmd-P' },
      });
      const input = editor.codemirror.getInputField();
      input.setAttribute('role', 'textbox');
      input.setAttribute('aria-multiline', 'true');
      input.setAttribute('aria-describedby', 'markdownHelp noteLength');
      document.getElementById('noteBodyLabel').addEventListener('click', () => editor.codemirror.focus());
      editor.codemirror.setOption('extraKeys', { ...editor.codemirror.getOption('extraKeys'), Tab: false, 'Shift-Tab': false });
      editor.codemirror.on('change', updateCount);
      i18n.on('languageChanged', updateLabels);
      updateLabels();
      editor.codemirror.refresh();
    }).catch((error) => { loading = null; throw error; });
  }
  return loading;
}

export function markdownValue() {
  return editor ? editor.value() : document.getElementById('noteBody').value;
}
export function setMarkdownValue(value = '') {
  document.getElementById('noteBody').value = value;
  if (!editor) return;
  if (editor.isPreviewActive()) editor.togglePreview();
  editor.value(value);
  // A new note or session must not retain another note's undo history.
  editor.codemirror.clearHistory();
  updateCount();
}
