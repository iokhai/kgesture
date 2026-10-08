import type { ActionId } from '../shared/actions';

export const DIAGNOSTICS_FLAG = 'kgesture:diagnostics';
export const DIAGNOSTICS_LOG = 'kgesture:diagnosticLog';
type Outcome = 'pending' | 'released' | 'cancelled' | 'unbound' | 'executed' | 'failed';
export interface GestureTrace {
  version: string; startedAt: number; finishedAt?: number; frame: 'top' | 'child';
  moveEvents: number; buttonlessMoves: number;
  lastInput?: { type: string; button?: number; buttons?: number; x?: number; y?: number };
  pattern?: string; action?: ActionId; outcome?: Outcome; reason?: string;
  startY: number; releaseY?: number; afterY?: number; settledY?: number;
  moved?: boolean; error?: string;
}
let active: GestureTrace | undefined;
const history: GestureTrace[] = [];

// Opt in per page through sessionStorage. No point history or storage writes otherwise.
export function beginDiagnostics(): void {
  active = undefined;
  try {
    if (sessionStorage.getItem(DIAGNOSTICS_FLAG) !== '1') return;
    active = {
      version: chrome.runtime.getManifest().version, startedAt: Date.now(),
      frame: window === window.top ? 'top' : 'child',
      moveEvents: 0, buttonlessMoves: 0, startY: window.scrollY, outcome: 'pending',
    };
    history.push(active);
    if (history.length > 16) history.shift();
    persist();
    const trace = active;
    setTimeout(() => { if (active === trace) persist(); }, 1000);
  } catch { /* Restricted storage must never affect a gesture. */ }
}
export function inputDiagnostics(event: Event): void {
  if (!active) return;
  const input = event as Partial<MouseEvent>;
  active.lastInput = { type: event.type, button: input.button, buttons: input.buttons, x: input.clientX, y: input.clientY };
  if (event.type === 'pointermove') {
    active.moveEvents++;
    if (!(input.buttons! & 2)) active.buttonlessMoves++;
  }
}
export function patternDiagnostics(pattern: string, action?: ActionId): void {
  if (active) Object.assign(active, { pattern, action });
}
function persist(): void {
  try {
    if (sessionStorage.getItem(DIAGNOSTICS_FLAG) === '1') sessionStorage.setItem(DIAGNOSTICS_LOG, JSON.stringify(history));
  } catch { /* Diagnostics are optional and cannot block input or actions. */ }
}
export function finishDiagnostics(outcome: Outcome, pattern: string, action?: ActionId, reason?: string): GestureTrace | undefined {
  const trace = active;
  active = undefined;
  if (!trace) return;
  Object.assign(trace, { outcome, pattern, action, reason, finishedAt: Date.now(), releaseY: window.scrollY });
  persist();
  return trace;
}
export function resultDiagnostics(trace: GestureTrace | undefined, ok: boolean, moved?: boolean, error?: string): void {
  if (!trace) return;
  Object.assign(trace, { outcome: ok ? 'executed' : 'failed', moved, error, afterY: window.scrollY });
  persist();
  if (moved !== undefined) setTimeout(() => {
    trace.settledY = window.scrollY;
    persist();
  }, 100);
}
