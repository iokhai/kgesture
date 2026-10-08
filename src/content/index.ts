import { Recognizer } from '../core/recognizer';
import { MenuGate } from '../core/menu';
import { hostExcluded, normalizeSettings, STORAGE_KEY } from '../shared/settings';
import type { Settings } from '../shared/settings';
import type { ActionId } from '../shared/actions';
import { Overlay } from './overlay';
import { t } from '../shared/i18n';

const recognizer = new Recognizer();
const menu = new MenuGate();
const overlay = new Overlay();
const earlyMenu = /Mac|Linux/.test(navigator.platform);
let settings: Settings;
let ready = false;
let enabled = false;
let bindings = new Map<string, ActionId>();
let active = false;
let target: Element | null = null;
let href: string | undefined;
let settingsRevision = 0;

function apply(value: unknown): void {
  cancel();
  settings = normalizeSettings(value);
  let host = location.host.toLowerCase();
  // about:blank child frames inherit their creator origin.
  if (!host) { try { host = new URL(document.referrer).host.toLowerCase(); } catch { /* no origin */ } }
  enabled = settings.enabled && !hostExcluded(host, settings.excludedHosts);
  bindings = new Map(settings.bindings.map(b => [b.pattern, b.action]));
  ready = true;
}
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STORAGE_KEY]) {
    settingsRevision++;
    apply(changes[STORAGE_KEY].newValue);
  }
});
const initialRevision = settingsRevision;
void chrome.storage.local.get(STORAGE_KEY).then(data => {
  if (settingsRevision === initialRevision) apply(data[STORAGE_KEY]);
}).catch(dispose);

function start(event: MouseEvent): void {
  if (!event.isTrusted || event.button !== 2 || event.ctrlKey || event.shiftKey || !ready || !enabled) return;
  if (!chrome.runtime.id) { dispose(); return; }
  cancel();
  active = true;
  target = event.composedPath().find(item => item instanceof Element) as Element | undefined ?? null;
  const anchor = event.composedPath().find(item => item instanceof HTMLAnchorElement) as HTMLAnchorElement | undefined;
  href = anchor?.href;
  if (!href) href = target?.closest<HTMLAnchorElement>('a[href]')?.href;
  menu.begin(performance.now());
  recognizer.start(event.clientX, event.clientY, settings.threshold);
  overlay.begin(event.clientX, event.clientY, settings);
  window.addEventListener('mousemove', move, { capture: true, passive: true });
  window.addEventListener('mouseup', end, true);
  window.addEventListener('blur', cancel);
  window.addEventListener('pagehide', cancel);
  window.addEventListener('keydown', key, true);
  window.addEventListener('resize', cancel);
  document.addEventListener('visibilitychange', visibility);
}
function move(event: MouseEvent): void {
  if (!event.isTrusted || !active) return;
  if (!(event.buttons & 2) || event.ctrlKey || event.shiftKey) { cancel(); return; }
  recognizer.move(event.clientX, event.clientY);
  overlay.point(event.clientX, event.clientY, recognizer.pattern, recognizer.overflow ? undefined : bindings.get(recognizer.pattern));
}
function end(event: MouseEvent): void {
  if (!event.isTrusted || event.button !== 2 || !active) return;
  if (event.ctrlKey || event.shiftKey) { cancel(); return; }
  recognizer.move(event.clientX, event.clientY);
  const pattern = recognizer.pattern;
  const action = recognizer.overflow ? undefined : bindings.get(pattern);
  const startTarget = target, link = href;
  menu.finish(performance.now(), !!pattern);
  cancel();
  if (action) execute(action, startTarget, link);
}
function key(event: KeyboardEvent): void { if (event.isTrusted && ['Escape', 'Control', 'Shift'].includes(event.key)) cancel(); }
function visibility(): void { if (document.hidden) cancel(); }
function cancel(): void {
  active = false; target = null; href = undefined;
  window.removeEventListener('mousemove', move, true);
  window.removeEventListener('mouseup', end, true);
  window.removeEventListener('blur', cancel);
  window.removeEventListener('pagehide', cancel);
  window.removeEventListener('keydown', key, true);
  window.removeEventListener('resize', cancel);
  document.removeEventListener('visibilitychange', visibility);
  overlay.clear();
}
function context(event: MouseEvent): void {
  if (!event.isTrusted || !ready || !enabled || event.ctrlKey || event.shiftKey) return;
  if (menu.shouldSuppress(performance.now(), earlyMenu, active)) event.preventDefault();
}
function dispose(): void {
  enabled = false; cancel();
  window.removeEventListener('mousedown', start, true);
  window.removeEventListener('contextmenu', context, true);
}
function execute(action: ActionId, element: Element | null, link: string | undefined): void {
  if (action === 'scrollTop' || action === 'scrollBottom') {
    // Resolve a nested scroll container once, only when executing a scroll action.
    let scroll: Element | null = element;
    while (scroll && scroll !== document.scrollingElement) {
      if (scroll.scrollHeight > scroll.clientHeight && /auto|scroll/.test(getComputedStyle(scroll).overflowY)) break;
      scroll = scroll.parentElement;
    }
    scroll ??= document.scrollingElement;
    scroll?.scrollTo({ top: action === 'scrollTop' ? 0 : scroll.scrollHeight, behavior: 'instant' });
  } else if (action === 'stop') window.stop();
  else {
    // At most one message per completed command; the worker validates binding and sender.
    try {
      void chrome.runtime.sendMessage({ type: 'gesture', pattern: recognizer.pattern, action, href: link })
        .then((response: { ok?: boolean; error?: string } | undefined) => {
          if (!response?.ok) console.warn('KGesture:', response?.error ?? t('noResponse'));
        }).catch(error => { if (!chrome.runtime.id) dispose(); else console.warn('KGesture:', error); });
    } catch { dispose(); }
  }
}
window.addEventListener('mousedown', start, { capture: true, passive: true });
window.addEventListener('contextmenu', context, true);
