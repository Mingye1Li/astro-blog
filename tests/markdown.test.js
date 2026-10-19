import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createMarkdownRenderer } from '../src/lib/markdown.js';

function setup() {
  const window = new JSDOM('', { url: 'https://mingye1li.github.io/' }).window;
  const render = createMarkdownRenderer(window);
  return { render, parse: (source) => JSDOM.fragment(render(source)), window };
}

test('renders headings, lists, formatting, fenced code, and GFM tables', () => {
  const { parse, window } = setup();
  try {
    const result = parse('# Heading\n\n**bold** and *italic*\n\n- one\n- two\n\n```js\nconst value = 1;\n```\n\n| A | B |\n|---|---|\n| 1 | 2 |');
    assert.equal(result.querySelector('h1').textContent, 'Heading');
    assert.equal(result.querySelector('strong').textContent, 'bold');
    assert.equal(result.querySelector('em').textContent, 'italic');
    assert.equal(result.querySelectorAll('li').length, 2);
    assert.match(result.querySelector('pre code').textContent, /const value = 1;/);
    assert.equal(result.querySelectorAll('table td').length, 2);
  } finally { window.close(); }
});

test('removes executable HTML, unsafe links, and application-clobbering attributes', () => {
  const { parse, window } = setup();
  try {
    const fragment = parse('<script>alert(1)</script><img src="x" onerror="alert(1)"><iframe src="https://example.com"></iframe><svg onload="alert(1)"></svg>\n\n[bad](javascript:alert%281%29)\n\n<p id="logoutBtn" name="notes" data-i18n="auth.logout" data-i18n-options="not json" style="position:fixed">Text</p><form><input name="password"></form>');
    assert.equal(fragment.querySelector('script,iframe,svg,form,input'), null);
    assert.equal(fragment.querySelector('[onerror],[onload],[id],[name],[style],[data-i18n],[data-i18n-options]'), null);
    for (const anchor of fragment.querySelectorAll('a')) assert.ok(!anchor.getAttribute('href')?.startsWith('javascript:'));
  } finally { window.close(); }
});

test('keeps plain-text notes readable and isolates external links', () => {
  const { parse, window } = setup();
  try {
    const fragment = parse('Existing plain text\nsecond line\n\n[safe](https://example.com)\n\n![image](https://example.com/picture.png)');
    assert.match(fragment.textContent, /Existing plain text/);
    assert.ok(fragment.querySelector('br'));
    assert.equal(fragment.querySelector('a').getAttribute('target'), '_blank');
    assert.equal(fragment.querySelector('a').getAttribute('rel'), 'noopener noreferrer');
    assert.equal(fragment.querySelector('img').getAttribute('referrerpolicy'), 'no-referrer');
  } finally { window.close(); }
});
