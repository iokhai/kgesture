import type { ActionId } from '../shared/actions';
import { openSettings } from './open-settings';
import { t } from '../shared/i18n';

export function safeLink(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 8192) return undefined;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined; }
  catch { return undefined; }
}
export async function executeAction(action: ActionId, tabId: number, windowId: number, href?: string): Promise<void> {
  // Always act on the sender tab, even if focus moved while the worker woke up.
  switch (action) {
    case 'back': await chrome.tabs.goBack(tabId); break;
    case 'forward': await chrome.tabs.goForward(tabId); break;
    case 'reload': await chrome.tabs.reload(tabId); break;
    case 'reloadHard': await chrome.tabs.reload(tabId, { bypassCache: true }); break;
    case 'newTab': case 'newBackgroundTab': {
      const tab = await chrome.tabs.get(tabId);
      await chrome.tabs.create({ windowId, index: tab.index + 1, active: action === 'newTab', ...(safeLink(href) ? { url: safeLink(href) } : {}) });
      break;
    }
    case 'closeTab': { const tab = await chrome.tabs.get(tabId); if (!tab.pinned) await chrome.tabs.remove(tabId); break; }
    case 'restoreTab': {
      const closed = await chrome.sessions.getRecentlyClosed({ maxResults: 1 });
      const id = closed[0]?.tab?.sessionId;
      // Do not accidentally restore an entire closed window.
      if (id) await chrome.sessions.restore(id);
      break;
    }
    case 'duplicateTab': await chrome.tabs.duplicate(tabId); break;
    case 'togglePin': { const tab = await chrome.tabs.get(tabId); await chrome.tabs.update(tabId, { pinned: !tab.pinned }); break; }
    case 'nextTab': case 'previousTab': {
      const tabs = await chrome.tabs.query({ windowId });
      const index = tabs.findIndex(t => t.id === tabId);
      if (index < 0 || tabs.length < 2) return;
      const next = tabs[(index + (action === 'nextTab' ? 1 : -1) + tabs.length) % tabs.length];
      if (next?.id !== undefined) await chrome.tabs.update(next.id, { active: true });
      break;
    }
    case 'closeLeft': case 'closeRight': {
      const tabs = await chrome.tabs.query({ windowId });
      const current = tabs.find(t => t.id === tabId);
      if (!current) return;
      const ids = tabs.filter(t => !t.pinned && (action === 'closeLeft' ? t.index < current.index : t.index > current.index))
        .flatMap(t => t.id === undefined ? [] : [t.id]);
      if (ids.length) await chrome.tabs.remove(ids);
      break;
    }
    case 'options': await openSettings(); break;
    default: throw new Error(t('localOnlyAction'));
  }
}
