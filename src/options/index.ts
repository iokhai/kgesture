import { ACTIONS, arrows } from '../shared/actions';
import { DEFAULT_SETTINGS, normalizeSettings, STORAGE_KEY, validateSettings } from '../shared/settings';
import type { Settings } from '../shared/settings';
import type { ActionId } from '../shared/actions';
import { GestureRecorder } from './recorder';
import { t } from '../shared/i18n';
import { localize } from './localize';

localize();

function el<T extends HTMLElement>(id: string): T { return document.getElementById(id) as T; }
const form = el<HTMLFormElement>('settings-form');
const tbody = el<HTMLTableSectionElement>('bindings');
const status = el('status');
let loaded = false;
function report(text: string, error = false): void { status.textContent = text; status.classList.toggle('error', error); }
function count(): void { el('binding-count').textContent = String(tbody.rows.length); }
const recorder = new GestureRecorder(() => ({
  threshold: Number(el<HTMLInputElement>('threshold').value),
  trailColor: el<HTMLInputElement>('trailColor').value,
  trailWidth: Number(el<HTMLInputElement>('trailWidth').value),
}));
function record(tr: HTMLTableRowElement | null): void {
  recorder.open({
    conflict: pattern => {
      const match = Array.from(tbody.rows).find(other => other !== tr && other.dataset.pattern === pattern);
      return match ? ACTIONS[match.querySelector('select')!.value as ActionId] : undefined;
    },
    commit: pattern => {
      if (tr) {
        tr.dataset.pattern = pattern;
        tr.querySelector('.direction')!.textContent = arrows(pattern);
      } else row(pattern, 'reload');
      report(t('unsaved'));
    },
  });
}
function row(pattern: string, action: ActionId): void {
  const tr = document.createElement('tr');
  tr.dataset.pattern = pattern;
  const direction = document.createElement('span'); direction.className = 'direction'; direction.textContent = arrows(pattern);
  const button = document.createElement('button'); button.type = 'button'; button.className = 'gesture-button';
  button.ariaLabel = t('rerecordGesture'); button.title = t('rerecord');
  const mark = document.createElement('span'); mark.className = 'record-mark'; mark.textContent = '↺'; mark.ariaHidden = 'true';
  button.append(direction, mark); button.addEventListener('click', () => record(tr));
  const select = document.createElement('select'); select.ariaLabel = t('action');
  for (const [id, label] of Object.entries(ACTIONS)) { const option = document.createElement('option'); option.value = id; option.textContent = label; select.append(option); }
  select.value = action;
  const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove'; remove.textContent = '×'; remove.ariaLabel = t('deleteGesture');
  remove.addEventListener('click', () => { tr.remove(); count(); report(t('unsaved')); });
  const cells = [document.createElement('td'), document.createElement('td'), document.createElement('td')];
  cells[0]!.append(button); cells[1]!.append(select); cells[2]!.append(remove); tr.append(...cells); tbody.append(tr); count();
}
function render(s: Settings): void {
  recorder.close();
  for (const id of ['enabled', 'showTrail', 'showHint'] as const) el<HTMLInputElement>(id).checked = s[id];
  for (const id of ['threshold', 'trailWidth', 'trailColor'] as const) el<HTMLInputElement>(id).value = String(s[id]);
  el<HTMLTextAreaElement>('excludedHosts').value = s.excludedHosts.join('\n');
  el('threshold-value').textContent = `${s.threshold} px`;
  tbody.replaceChildren(); s.bindings.forEach(b => row(b.pattern, b.action));
}
function read(): Settings {
  return {
    version: 1, enabled: el<HTMLInputElement>('enabled').checked, showTrail: el<HTMLInputElement>('showTrail').checked,
    showHint: el<HTMLInputElement>('showHint').checked, threshold: Number(el<HTMLInputElement>('threshold').value),
    trailWidth: Number(el<HTMLInputElement>('trailWidth').value), trailColor: el<HTMLInputElement>('trailColor').value,
    excludedHosts: el<HTMLTextAreaElement>('excludedHosts').value.split('\n').map(h => h.trim().toLowerCase()).filter(Boolean),
    bindings: Array.from(tbody.rows, tr => ({ pattern: tr.dataset.pattern!, action: tr.querySelector('select')!.value as ActionId })),
  };
}
form.addEventListener('input', () => report(t('unsaved')));
el('enabled').addEventListener('change', () => report(t('unsaved')));
el('threshold').addEventListener('input', () => { el('threshold-value').textContent = `${el<HTMLInputElement>('threshold').value} px`; });
form.addEventListener('submit', event => {
  event.preventDefault(); if (!loaded) return;
  const s = read(), error = validateSettings(s);
  if (error) { report(error, true); return; }
  const button = el<HTMLButtonElement>('save'); button.disabled = true;
  void chrome.storage.local.set({ [STORAGE_KEY]: normalizeSettings(s) }).then(() => report(t('saved')))
    .catch(() => report(t('saveFailed'), true)).finally(() => { button.disabled = false; });
});
el('add-binding').addEventListener('click', () => {
  if (tbody.rows.length >= 128) { report(t('tooManyGestures'), true); return; }
  if (loaded) record(null);
});
el('reset').addEventListener('click', () => { render(structuredClone(DEFAULT_SETTINGS)); report(t('defaultsRestored')); });
el('export').addEventListener('click', () => {
  const s = read(), error = validateSettings(s); if (error) { report(error, true); return; }
  const url = URL.createObjectURL(new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'kgesture-settings.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); report(t('exported'));
});
el<HTMLInputElement>('import').addEventListener('change', async event => {
  const input = event.currentTarget as HTMLInputElement, file = input.files?.[0];
  if (!file) return;
  try {
    if (file.size > 128 * 1024) throw new Error(t('fileTooLarge'));
    let value: unknown;
    try { value = JSON.parse(await file.text()); }
    catch { throw new Error(t('invalidJson')); }
    const error = validateSettings(value); if (error) throw new Error(error);
    render(normalizeSettings(value)); report(t('imported'));
  } catch (error) { report(error instanceof Error ? error.message : t('importFailed'), true); }
  input.value = '';
});
void chrome.storage.local.get(STORAGE_KEY).then(data => { render(normalizeSettings(data[STORAGE_KEY])); loaded = true; el<HTMLButtonElement>('add-binding').disabled = false; })
  .catch(() => report(t('loadFailed'), true));
