import { Overlay } from '../src/content/overlay';
import { DEFAULT_SETTINGS } from '../src/shared/settings';

export type OverlayMode = 'both' | 'hint' | 'trail' | 'off';
// Controlled frame flushing measures JS + Canvas submission, excluding vsync and compositing.
export function run(mode: OverlayMode, samples = 10000, frameEvery = 8) {
  const originalRequest = window.requestAnimationFrame, originalCancel = window.cancelAnimationFrame;
  let pending: FrameRequestCallback | undefined, requested = 0, callbacks = 0;
  window.requestAnimationFrame = callback => { pending = callback; return ++requested; };
  window.cancelAnimationFrame = () => { pending = undefined; };
  const flush = () => { const callback = pending; pending = undefined; if (callback) { callbacks++; callback(0); } };
  const overlay = new Overlay();
  try {
    const start = performance.now();
    overlay.begin(450, 400, { ...DEFAULT_SETTINGS, showHint: mode === 'both' || mode === 'hint', showTrail: mode === 'both' || mode === 'trail' });
    for (let i = 0; i < samples; i++) {
      overlay.point(450 + i % 5, 400 - i % 200, 'U', 'scrollTop');
      if ((i + 1) % frameEvery === 0) flush();
    }
    flush();
    const elapsedMs = performance.now() - start;
    return { mode, samples, frameEvery, elapsedMs, requested, callbacks };
  } finally {
    overlay.clear(); window.requestAnimationFrame = originalRequest; window.cancelAnimationFrame = originalCancel;
  }
}
