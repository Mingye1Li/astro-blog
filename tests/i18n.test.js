import test from 'node:test';
import assert from 'node:assert/strict';
import { createInstance } from 'i18next';
import { readFile, readdir } from 'node:fs/promises';
import { resources, fallback } from '../src/i18n/resources.js';

function keys(object, prefix = '') {
  return Object.entries(object).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [path] : keys(value, path);
  });
}

test('both languages cover the same translation keys, including plurals', () => {
  const normalize = (locale) => [...new Set(keys(resources[locale].translation).map((key) => key.replace(/_(one|other)$/, '')))].sort();
  assert.deepEqual(normalize('en'), normalize('zh-CN'));
});

test('all static Astro translation references exist in both languages', async () => {
  const engine = createInstance();
  await engine.init({ resources, fallbackLng: false });
  const directories = ['src/components', 'src/layouts'];
  for (const directory of directories) {
    for (const file of await readdir(new URL(`../${directory}/`, import.meta.url))) {
      const source = await readFile(new URL(`../${directory}/${file}`, import.meta.url), 'utf8');
      const references = [...source.matchAll(/(?:\bk|data-i18n(?:-placeholder)?)="([a-z]+\.[a-zA-Z]+)"/g)].map((match) => match[1]);
      for (const key of references) for (const lng of ['en', 'zh-CN']) assert.ok(engine.exists(key, { lng }), `${lng} is missing ${key} in ${file}`);
    }
  }
});

test('English approval counts pluralize and Chinese counts resolve', async () => {
  const engine = createInstance();
  await engine.init({ resources, fallbackLng: 'zh-CN' });
  assert.equal(engine.t('admin.summary', { lng: 'en', count: 1, total: 2 }), '1 pending request · Total accounts: 2');
  assert.equal(engine.t('admin.summary', { lng: 'en', count: 2, total: 3 }), '2 pending requests · Total accounts: 3');
  assert.equal(engine.t('admin.summary', { lng: 'zh-CN', count: 2, total: 3 }), '2 个待审批账号 · 共 3 个账号');
  assert.equal(fallback('auth.signup'), '申请账号');
});

test('action labels interpolate user content without dropping characters', async () => {
  const engine = createInstance();
  await engine.init({ resources, lng: 'en', interpolation: { escapeValue: false } });
  const title = '<b>A & B</b>';
  assert.equal(engine.t('workspace.editLabel', { title }), 'Edit: <b>A & B</b>');
  // DOM code uses textContent/setAttribute, so this value stays text rather than markup.
  await engine.changeLanguage('zh-CN');
  assert.equal(engine.t('workspace.editLabel', { title }), '编辑：<b>A & B</b>');
});
