import test from 'node:test';
import assert from 'node:assert/strict';
import { beginDiagnostics, DIAGNOSTICS_FLAG, DIAGNOSTICS_LOG, finishDiagnostics, inputDiagnostics, patternDiagnostics, resultDiagnostics } from '../src/content/diagnostics';

test('diagnostics are opt-in, bounded, and report cancellation and later scroll rollback', async () => {
  const names = ['sessionStorage', 'window', 'chrome'] as const;
  const saved = names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const);
  const data = new Map<string, string>(); let writes = 0;
  const view = { scrollY: 600, top: undefined as unknown }; view.top = view;
  const values = {
    sessionStorage: { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); writes++; } },
    window: view, chrome: { runtime: { getManifest: () => ({ version: 'test' }) } },
  };
  const entries = () => JSON.parse(data.get(DIAGNOSTICS_LOG) ?? '[]') as Array<Record<string, unknown>>;
  try {
    for (const name of names) Object.defineProperty(globalThis, name, { configurable: true, value: values[name] });
    beginDiagnostics(); inputDiagnostics({ type: 'pointermove', buttons: 0 } as PointerEvent);
    assert.equal(finishDiagnostics('cancelled', 'U', 'scrollTop', 'blur'), undefined);
    assert.equal(writes, 0);
    data.set(DIAGNOSTICS_FLAG, '1');
    beginDiagnostics(); patternDiagnostics('U', 'scrollTop');
    inputDiagnostics({ type: 'pointermove', buttons: 0, button: -1, clientX: 10, clientY: 20 } as PointerEvent);
    finishDiagnostics('cancelled', 'U', 'scrollTop', 'blur');
    assert.equal(entries()[0]!.outcome, 'cancelled'); assert.equal(entries()[0]!.reason, 'blur');
    assert.equal(entries()[0]!.buttonlessMoves, 1); assert.equal(entries()[0]!.pattern, 'U');
    beginDiagnostics(); const released = finishDiagnostics('released', 'U', 'scrollTop');
    view.scrollY = 0; resultDiagnostics(released, true, true);
    view.scrollY = 600;
    await new Promise(resolve => setTimeout(resolve, 120));
    assert.equal(entries()[1]!.afterY, 0); assert.equal(entries()[1]!.settledY, 600);
    for (let i = 0; i < 20; i++) { beginDiagnostics(); finishDiagnostics('unbound', 'UR'); }
    assert.equal(entries().length, 16);
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, get() { throw new Error('Blocked'); } });
    assert.doesNotThrow(() => { beginDiagnostics(); finishDiagnostics('cancelled', ''); });
  } finally {
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});
