import test from 'node:test';
import assert from 'node:assert/strict';
import { executeAction } from '../src/background/actions';

test('tab actions protect pins, use sender tab, wrap in sender window, and filter bulk close', async () => {
  const calls: unknown[][] = [];
  const tabs = [
    { id: 1, index: 0, windowId: 9, pinned: true }, { id: 2, index: 1, windowId: 9, pinned: false },
    { id: 3, index: 2, windowId: 9, pinned: false }, { id: 4, index: 3, windowId: 9, pinned: true },
  ];
  const old = globalThis.chrome;
  globalThis.chrome = {
    tabs: {
      get: async (id: number) => tabs.find(t => t.id === id), query: async (query: unknown) => { calls.push(['query', query]); return tabs; },
      remove: async (id: unknown) => { calls.push(['remove', id]); }, update: async (...args: unknown[]) => { calls.push(['update', ...args]); },
      reload: async (...args: unknown[]) => { calls.push(['reload', ...args]); },
      create: async (...args: unknown[]) => { calls.push(['create', ...args]); },
    },
  } as unknown as typeof chrome;
  try {
    await executeAction('closeTab', 1, 9); assert.equal(calls.length, 0);
    await executeAction('closeTab', 3, 9); assert.deepEqual(calls.pop(), ['remove', 3]);
    await executeAction('closeLeft', 3, 9); assert.deepEqual(calls.pop(), ['remove', [2]]); calls.length = 0;
    await executeAction('closeRight', 2, 9); assert.deepEqual(calls.pop(), ['remove', [3]]); calls.length = 0;
    await executeAction('nextTab', 4, 9); assert.deepEqual(calls.pop(), ['update', 1, { active: true }]); assert.deepEqual(calls.pop(), ['query', { windowId: 9 }]);
    await executeAction('reloadHard', 2, 9); assert.deepEqual(calls.pop(), ['reload', 2, { bypassCache: true }]);
    await executeAction('newTab', 2, 9, 'javascript:alert(1)'); assert.deepEqual(calls.pop(), ['create', { windowId: 9, index: 2, active: true }]);
  } finally { globalThis.chrome = old; }
});
test('restore ignores a closed window rather than restoring a whole session', async () => {
  const old = globalThis.chrome; let restored = false;
  globalThis.chrome = { sessions: { getRecentlyClosed: async () => [{ window: { sessionId: 'window' } }], restore: async () => { restored = true; } } } as unknown as typeof chrome;
  try { await executeAction('restoreTab', 1, 1); assert.equal(restored, false); }
  finally { globalThis.chrome = old; }
});
