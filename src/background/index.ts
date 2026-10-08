import { isAction } from '../shared/actions';
import { hostExcluded, normalizeSettings, STORAGE_KEY, validPattern } from '../shared/settings';
import type { Settings } from '../shared/settings';
import { executeAction, safeLink } from './actions';
import { openSettings } from './open-settings';
import { t } from '../shared/i18n';

chrome.action.onClicked.addListener(() => {
  void openSettings().catch(error => console.error('KGesture:', t('openSettingsFailed'), error));
});
chrome.runtime.onInstalled.addListener(() => {
  void chrome.action.setPopup({ popup: '' }).catch(error => console.error('KGesture:', t('clearPopupFailed'), error));
});

let cached: Promise<Settings> | undefined;
let revision = 0;
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STORAGE_KEY]) {
    revision++;
    cached = Promise.resolve(normalizeSettings(changes[STORAGE_KEY].newValue));
  }
});
function loadSettings(): Promise<Settings> {
  if (cached) return cached;
  const startRevision = revision;
  cached = chrome.storage.local.get(STORAGE_KEY).then(data => {
    if (revision !== startRevision) return cached!;
    return normalizeSettings(data[STORAGE_KEY]);
  }).catch(error => { cached = undefined; throw error; });
  return cached;
}

chrome.runtime.onMessage.addListener((message: unknown, sender, reply) => {
  if (!message || typeof message !== 'object' || !('type' in message) || message.type !== 'gesture') return false;
  const data = message as Record<string, unknown>;
  if (sender.id !== chrome.runtime.id || sender.tab?.id === undefined || !sender.url || !isAction(data.action) || !validPattern(data.pattern)) {
    reply({ ok: false, error: t('invalidRequest') }); return false;
  }
  const tab = sender.tab, action = data.action, pattern = data.pattern;
  void (async () => {
    const settings = await loadSettings();
    const url = new URL(sender.url!);
    // An opaque about:blank frame uses its tab URL for exclusion policy.
    const host = url.host || (tab.url ? new URL(tab.url).host : '');
    if (!settings.enabled || hostExcluded(host.toLowerCase(), settings.excludedHosts)
      || !settings.bindings.some(b => b.pattern === pattern && b.action === action)) throw new Error(t('bindingChanged'));
    await executeAction(action, tab.id!, tab.windowId, safeLink(data.href));
    reply({ ok: true });
  })().catch((error: unknown) => reply({ ok: false, error: error instanceof Error ? error.message : t('actionFailed') }));
  return true;
});
