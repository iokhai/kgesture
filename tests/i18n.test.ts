import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { t } from '../src/shared/i18n';
import { DEFAULT_SETTINGS, validateSettings } from '../src/shared/settings';

interface Message { message: string; placeholders?: Record<string, { content: string }> }
type Catalog = Record<string, Message>;
const root = new URL('../', import.meta.url);
function catalog(locale: string): Catalog {
  return JSON.parse(readFileSync(new URL(`public/_locales/${locale}/messages.json`, root), 'utf8')) as Catalog;
}
const en = catalog('en');
const zh = catalog('zh_CN');

test('locales have the same keys and valid substitution placeholders', () => {
  for (const name of readdirSync(new URL('public/_locales/', root))) {
    const locale = catalog(name);
    assert.deepEqual(Object.keys(locale).sort(), Object.keys(en).sort());
    for (const [key, entry] of Object.entries(locale)) {
    assert.ok(entry.message.trim(), `${key} is empty`);
    const referenced = Array.from(entry.message.matchAll(/\$([a-z_]+)\$/gi), match => match[1]!.toLowerCase()).sort();
    assert.deepEqual(referenced, Object.keys(entry.placeholders ?? {}).sort(), `${key} has mismatched placeholders`);
    for (const placeholder of Object.values(entry.placeholders ?? {})) assert.match(placeholder.content, /^\$[1-9]$/);
    assert.deepEqual(entry.placeholders, en[key]!.placeholders, `${key} changes substitution order`);
    }
  }
});

test('a new locale is discovered without a registry and malformed translations fail validation', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'kgesture-locales-'));
  try {
    await cp(new URL('public/_locales/', root), temporary, { recursive: true });
    const next = structuredClone(en); next.localeTag!.message = 'de';
    const path = join(temporary, 'de'); await cp(new URL('public/_locales/en/', root), path, { recursive: true });
    await writeFile(join(path, 'messages.json'), JSON.stringify(next));
    const run = () => execFileSync(process.execPath, ['scripts/check-locales.mjs', temporary], { cwd: root, encoding: 'utf8', stdio: 'pipe' });
    assert.deepEqual(JSON.parse(run()).locales, ['de', 'en', 'zh_CN']);
    delete next.actionBack; await writeFile(join(path, 'messages.json'), JSON.stringify(next));
    assert.throws(run, /message keys must match/);
    const broken = JSON.parse(await readFile(new URL('public/_locales/en/messages.json', root), 'utf8')) as Catalog;
    broken.localeTag!.message = 'de'; broken.gestureAlreadyUsed!.message = 'Already used by $UNKNOWN$';
    await writeFile(join(path, 'messages.json'), JSON.stringify(broken));
    assert.throws(run, /placeholders do not match/);
  } finally { await rm(temporary, { recursive: true, force: true }); }
});

test('every static, dynamic, and manifest message reference has a translation', () => {
  const paths = ['src', 'public/options.html', 'public/manifest.json'];
  function visit(path: string): string[] {
    if (path.endsWith('.ts') || path.endsWith('.html') || path.endsWith('.json')) return [path];
    return readdirSync(new URL(path + '/', root), { withFileTypes: true })
      .flatMap(entry => entry.isDirectory() ? visit(`${path}/${entry.name}`) : [`${path}/${entry.name}`]);
  }
  for (const path of paths.flatMap(visit)) {
    const source = readFileSync(new URL(path, root), 'utf8');
    for (const pattern of [/\bt\('([^']+)'/g, /data-i18n(?:-aria-label)?="([^"]+)"/g, /__MSG_(\w+)__/g]) {
      for (const match of source.matchAll(pattern)) assert.ok(en[match[1]!], `${path} uses missing message ${match[1]}`);
    }
  }
});

test('native getMessage localizes validation and substitutions without altering stored action IDs', () => {
  const old = globalThis.chrome;
  let locale = en;
  globalThis.chrome = { i18n: { getMessage: (key: string, substitutions: string[] = []) => {
    const entry = locale[key] ?? en[key];
    if (!entry) return '';
    return entry.message.replace(/\$([a-z_]+)\$/gi, (_, name: string) => {
      const index = Number(entry.placeholders![name.toLowerCase()]!.content.slice(1)) - 1;
      return substitutions[index] ?? '';
    });
  } } } as unknown as typeof chrome;
  try {
    assert.equal(t('settingsHeading'), 'Gesture settings');
    assert.equal(t('gestureAlreadyUsed', ['Back']), 'Already assigned to “Back”.');
    assert.equal(validateSettings({ ...DEFAULT_SETTINGS, threshold: 1 }), en.invalidThreshold!.message);
    locale = zh;
    assert.equal(t('settingsHeading'), '手势设置');
    assert.equal(t('gestureAlreadyUsed', ['后退']), '已用于「后退」');
    assert.equal(validateSettings({ ...DEFAULT_SETTINGS, threshold: 1 }), zh.invalidThreshold!.message);
    assert.equal(t('duplicatePattern', ['↓←']), '手势 ↓← 重复。');
    assert.equal(DEFAULT_SETTINGS.bindings[0]!.action, 'back');
  } finally { globalThis.chrome = old; }
});
