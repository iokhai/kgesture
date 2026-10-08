import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS } from '../src/shared/settings';

test('worker validates requests, caches settings, and responds to live disabling', async () => {
  type Reply = (response: unknown) => void;
  let listener!: (message: unknown, sender: chrome.runtime.MessageSender, reply: Reply) => boolean;
  let changed!: (changes: Record<string, chrome.storage.StorageChange>, area: string) => void;
  let toolbarClick!: () => void;
  let installed!: () => void;
  let popup: string | undefined;
  let openedOptions = 0;
  const calls: number[] = []; let reads = 0;
  const old = globalThis.chrome;
  globalThis.chrome = {
    runtime: { id: 'kgesture', onMessage: { addListener: (fn: typeof listener) => { listener = fn; } },
      onInstalled: { addListener: (fn: typeof installed) => { installed = fn; } },
      getURL: (path: string) => `chrome-extension://kgesture/${path}`, getContexts: async () => [] },
    action: { onClicked: { addListener: (fn: typeof toolbarClick) => { toolbarClick = fn; } }, setPopup: async (details: { popup: string }) => { popup = details.popup; } },
    storage: { local: { get: async () => { reads++; return { settings: DEFAULT_SETTINGS }; } }, onChanged: { addListener: (fn: typeof changed) => { changed = fn; } } },
    tabs: { reload: async (id: number) => { calls.push(id); }, create: async () => { openedOptions++; return { id: 10, windowId: 2 }; } },
    windows: { update: async () => ({}) },
  } as unknown as typeof chrome;
  try {
    await import('../src/background/index');
    installed(); assert.equal(popup, '');
    toolbarClick(); await new Promise(resolve => setImmediate(resolve)); assert.equal(openedOptions, 1);
    const sender = { id: 'kgesture', url: 'https://example.com', tab: { id: 7, windowId: 2 } } as chrome.runtime.MessageSender;
    const request = (message: unknown, source = sender): Promise<{ ok: boolean }> => new Promise(resolve => {
      listener(message, source, response => resolve(response as { ok: boolean }));
    });
    assert.equal((await request({ type: 'gesture', pattern: 'DU', action: 'reload' })).ok, true);
    assert.equal((await request({ type: 'gesture', pattern: 'DU', action: 'reload' })).ok, true);
    assert.deepEqual(calls, [7, 7]); assert.equal(reads, 1);
    assert.equal((await request({ type: 'gesture', pattern: 'L', action: 'reload' })).ok, false);
    assert.equal((await request({ type: 'gesture', pattern: 'DU', action: 'reload' }, { ...sender, id: 'other' })).ok, false);
    changed({ settings: { newValue: { ...DEFAULT_SETTINGS, enabled: false } } }, 'local');
    assert.equal((await request({ type: 'gesture', pattern: 'DU', action: 'reload' })).ok, false);
    assert.deepEqual(calls, [7, 7]); assert.equal(reads, 1);
  } finally { globalThis.chrome = old; }
});
