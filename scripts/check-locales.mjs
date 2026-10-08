import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const project = new URL('../', import.meta.url);
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const sortedKeys = object => Object.keys(object).sort();

function signature(entry, location) {
  if (!entry || typeof entry !== 'object' || typeof entry.message !== 'string' || !entry.message.trim()) {
    throw new Error(`${location}: message must be a non-empty string`);
  }
  const placeholders = entry.placeholders ?? {};
  if (typeof placeholders !== 'object' || !placeholders || Array.isArray(placeholders)) throw new Error(`${location}: invalid placeholders`);
  const names = sortedKeys(placeholders).map(name => name.toLowerCase()).sort();
  if (new Set(names).size !== names.length) throw new Error(`${location}: duplicate placeholder names`);
  const referenced = [...new Set(Array.from(entry.message.matchAll(/(?<!\$)\$([a-z_][a-z0-9_]*)\$(?!\$)/gi), match => match[1].toLowerCase()))].sort();
  if (!equal(names, referenced)) throw new Error(`${location}: placeholders do not match the message`);
  return Object.entries(placeholders).map(([name, placeholder]) => {
    if (!placeholder || !/^\$[1-9]$/.test(placeholder.content)) throw new Error(`${location}: placeholder ${name} must reference $1–$9`);
    return [name.toLowerCase(), placeholder.content];
  }).sort(([left], [right]) => left.localeCompare(right));
}

async function sourceFiles(url) {
  const entries = await readdir(url, { withFileTypes: true });
  const files = await Promise.all(entries.map(entry => {
    const child = new URL(entry.name + (entry.isDirectory() ? '/' : ''), url);
    return entry.isDirectory() ? sourceFiles(child) : [child];
  }));
  return files.flat();
}

export async function checkLocales(catalogRoot = new URL('public/_locales/', project)) {
  const root = catalogRoot instanceof URL ? catalogRoot : pathToFileURL(resolve(catalogRoot) + '/');
  const { default_locale: defaultLocale } = JSON.parse(await readFile(new URL('public/manifest.json', project), 'utf8'));
  const directories = (await readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  const catalogs = new Map();
  for (const locale of directories) {
    if (!/^[a-z]{2,3}(?:_(?:[A-Z]{2}|[0-9]{3}))?$/.test(locale)) throw new Error(`${locale}: use a Chromium locale directory name`);
    const messages = JSON.parse(await readFile(new URL(`${locale}/messages.json`, root), 'utf8'));
    if (!messages || typeof messages !== 'object' || Array.isArray(messages)) throw new Error(`${locale}: invalid catalog`);
    catalogs.set(locale, messages);
  }
  const base = catalogs.get(defaultLocale);
  if (!base) throw new Error(`Missing default locale ${defaultLocale}`);
  const keys = sortedKeys(base);
  if (new Set(keys.map(key => key.toLowerCase())).size !== keys.length) throw new Error('Message names must be unique ignoring case');
  for (const [locale, messages] of catalogs) {
    if (!equal(sortedKeys(messages), keys)) throw new Error(`${locale}: message keys must match ${defaultLocale}`);
    for (const key of keys) {
      if (!/^[a-zA-Z0-9_]+$/.test(key)) throw new Error(`${locale}: invalid message key ${key}`);
      if (!equal(signature(messages[key], `${locale}/${key}`), signature(base[key], `${defaultLocale}/${key}`))) {
        throw new Error(`${locale}/${key}: substitution order must match ${defaultLocale}`);
      }
    }
    if (Intl.getCanonicalLocales(messages.localeTag.message)[0].toLowerCase() !== locale.replaceAll('_', '-').toLowerCase()) {
      throw new Error(`${locale}: localeTag must match the language directory`);
    }
  }
  const files = [...await sourceFiles(new URL('src/', project)), new URL('public/options.html', project), new URL('public/manifest.json', project)];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const patterns = [
      [/\bt\(\s*(['"])([a-zA-Z0-9_]+)\1/g, 2],
      [/data-i18n(?:-aria-label)?=['"]([a-zA-Z0-9_]+)['"]/g, 1],
      [/__MSG_([a-zA-Z0-9_]+)__/g, 1],
    ];
    for (const [pattern, group] of patterns) for (const match of source.matchAll(pattern)) {
      if (!Object.hasOwn(base, match[group])) throw new Error(`${file.pathname}: missing message ${match[group]}`);
      if (group === 1 && Object.keys(base[match[group]].placeholders ?? {}).length) {
        throw new Error(`${file.pathname}: static message ${match[group]} requires substitutions`);
      }
    }
  }
  return { locales: directories, messages: keys.length };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { console.log(JSON.stringify(await checkLocales(process.argv[2]))); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
