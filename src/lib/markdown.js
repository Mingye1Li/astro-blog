import createDOMPurify from 'dompurify';
import { Marked } from 'marked';

export const MAX_NOTE_LENGTH = 20000;

export function createMarkdownRenderer(window) {
  const purifier = createDOMPurify(window);
  const parser = new Marked({ gfm: true, breaks: true, async: false });
  purifier.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && node.hasAttribute('href')) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
    if (node.tagName === 'IMG') {
      node.setAttribute('loading', 'lazy');
      node.setAttribute('referrerpolicy', 'no-referrer');
    }
  });
  return (source = '') => purifier.sanitize(parser.parse(source), {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'iframe', 'object', 'embed', 'video', 'audio'],
    FORBID_ATTR: ['style', 'id', 'name'],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
  });
}

let renderer;
export function renderMarkdown(source) {
  renderer ??= createMarkdownRenderer(window);
  return renderer(source);
}
