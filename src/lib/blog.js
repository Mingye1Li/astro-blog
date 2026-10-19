import { Marked } from 'marked';
const parser = new Marked();
export function summary(source = '', length = 180) {
  function plain(tokens) {
    return tokens.map(t => t.type === 'html' ? '' : t.tokens ? plain(t.tokens) : t.text || '').join(' ');
  }
  const text = plain(parser.lexer(source)).replace(/\s+/g, ' ').trim();
  const chars = Array.from(text);
  return chars.length > length ? chars.slice(0, length).join('').trimEnd() + '…' : text;
}
export const postPath = slug => '/blog/' + encodeURIComponent(slug) + '/';
