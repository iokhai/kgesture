import { Recognizer } from '../core/recognizer';
import { processPointerSamples } from '../core/pointer-samples';
import { MenuGate } from '../core/menu';
import { hostExcluded, normalizeSettings, STORAGE_KEY } from '../shared/settings';
import type { Settings } from '../shared/settings';
import type { ActionId } from '../shared/actions';
import { Overlay } from './overlay';
import { t } from '../shared/i18n';
import { scrollToEdge } from './scroll';

const recognizer = new Recognizer();
const menu = new MenuGate();
const overlay = new Overlay();
const earlyMenu = /Mac|Linux/.test(navigator.platform);
let settings: Settings;
let ready = false;
let enabled = false;
let bindings = new Map<string, ActionId>();
let active = false;
let gestureAction: ActionId | undefined;
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
  window.addEventListener('pointermove', move, { capture: true, passive: true });
  // Mouse button events fire for each button; pointerup waits for ALL buttons.
  window.addEventListener('mouseup', end, true);
  window.addEventListener('pointercancel', pointerCancel, true);
  window.addEventListener('blur', cancel);
  window.addEventListener('pagehide', cancel);
  window.addEventListener('keydown', key, true);
  window.addEventListener('resize', cancel);
  document.addEventListener('visibilitychange', visibility);
}
function sample(x: number, y: number): void {
  if (recognizer.move(x, y)) gestureAction = recognizer.overflow ? undefined : bindings.get(recognizer.pattern);
  overlay.point(x, y, recognizer.pattern, gestureAction);
}
function move(event: PointerEvent): void {
  if (!event.isTrusted || event.pointerType !== 'mouse' || !active) return;
  // Chorded button changes also emit pointermove. Let mouseup finish the command.
  if (event.button !== -1) return;
  if (!(event.buttons & 2) || event.ctrlKey || event.shiftKey) { cancel(); return; }
  processPointerSamples(event, sample);
}
function end(event: MouseEvent): void {
  if (!event.isTrusted || event.button !== 2 || !active) return;
  if (event.ctrlKey || event.shiftKey) { cancel(); return; }
  // Like simpleGestures, release executes the command confirmed by move events.
  // A different release coordinate must not silently replace the displayed command.
  const pattern = recognizer.pattern;
  const action = recognizer.overflow ? undefined : bindings.get(pattern);
  const startTarget = target, link = href;
  menu.finish(performance.now(), !!pattern);
  cancel();
  if (action) execute(action, startTarget, link);
}
function pointerCancel(event: PointerEvent): void { if (event.isTrusted && event.pointerType === 'mouse') cancel(); }
function key(event: KeyboardEvent): void { if (event.isTrusted && ['Escape', 'Control', 'Shift'].includes(event.key)) cancel(); }
function visibility(): void { if (document.hidden) cancel(); }
function cancel(): void {
  active = false; gestureAction = undefined; target = null; href = undefined;
  window.removeEventListener('pointermove', move, true);
  window.removeEventListener('mouseup', end, true);
  window.removeEventListener('pointercancel', pointerCancel, true);
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
    scrollToEdge(element, action === 'scrollTop' ? 'top' : 'bottom');
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
