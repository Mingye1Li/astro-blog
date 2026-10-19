import test from 'node:test';
import assert from 'node:assert/strict';
import { summary, postPath } from '../src/lib/blog.js';
import { safeReturnPath } from '../src/lib/navigation.js';
test('summaries strip markup and truncate Unicode without splitting characters', () => {
  assert.equal(summary('# Hello\n\nA **bold** [link](https://example.com)'), 'Hello A bold link');
  assert.equal(summary('😀😀😀', 2), '😀😀…');
  assert.equal(summary('<script>alert(1)</script>'), '');
});
test('post links encode slugs and survive login return validation', () => {
  const path = postPath('你好-123');
  assert.equal(safeReturnPath(path, 'https://example.com'), path);
  assert.equal(safeReturnPath('/blog/../../admin/', 'https://example.com'), '/admin/');
  assert.equal(safeReturnPath('/blog//evil.example', 'https://example.com'), '/notes/');
});
