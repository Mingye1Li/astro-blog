import test from 'node:test';
import assert from 'node:assert/strict';
import { safeReturnPath, loginPath, destinationAfterLogin } from '../src/lib/navigation.js';

const origin = 'https://mingye1li.github.io';
test('login preserves the requested application page, query, and fragment', () => {
  const requested = new URL('/admin/?view=pending#requests', origin);
  const login = loginPath(requested);
  assert.equal(login, '/login/?next=%2Fadmin%2F%3Fview%3Dpending%23requests');
  assert.equal(destinationAfterLogin(new URL(login, origin).search, origin, 'admin'), '/admin/?view=pending#requests');
  assert.equal(loginPath(new URL('/', origin)), '/login/');
});
test('return destinations reject external sites, credentials, and login loops', () => {
  for (const value of ['https://evil.example/admin/', '//evil.example/notes/', '\\\\evil.example/admin/', 'javascript:alert(1)', '/login/?next=/admin/', '/unknown/', 'https://user:pass@mingye1li.github.io/admin/']) {
    assert.equal(safeReturnPath(value, origin), '/notes/');
  }
  assert.equal(safeReturnPath('/admin', origin), '/admin/');
  assert.equal(safeReturnPath('/blog/?post=example', origin), '/blog/?post=example');
  assert.equal(destinationAfterLogin('', origin, 'admin'), '/notes/');
});
test('non-admin users cannot return to an admin destination after login', () => {
  assert.equal(destinationAfterLogin('?next=%2Fadmin%2F', origin, 'member'), '/notes/');
  assert.equal(destinationAfterLogin('?next=%2Fnotes%2F%23draft', origin, 'member'), '/notes/#draft');
});
