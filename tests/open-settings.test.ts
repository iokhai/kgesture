import test from 'node:test';
import assert from 'node:assert/strict';
import { openSettings } from '../src/background/open-settings';

test('toolbar navigation creates, reuses, focuses, and recovers from a closed settings tab', async () => {
  const old = globalThis.chrome;
  const calls: unknown[][] = [];
  let contexts: { tabId: number; windowId: number; documentUrl: string }[] = [];
  let closed = false;
  let discoveryFails = false;
  const url = 'chrome-extension://kgesture/options.html';
  globalThis.chrome = {
    runtime: { getURL: () => url, getContexts: async (filter: unknown) => {
      calls.push(['contexts', filter]);
      if (discoveryFails) throw new Error('Discovery unavailable');
      return contexts;
    } },
    tabs: { create: async (details: unknown) => { calls.push(['create', details]); return { id: 10, windowId: 3 }; },
      update: async (id: number, details: unknown) => { calls.push(['update', id, details]); if (closed) throw new Error('Tab closed'); return { id, windowId: 7 }; } },
    windows: { update: async (id: number, details: unknown) => { calls.push(['focus', id, details]); } },
  } as unknown as typeof chrome;
  try {
    await Promise.all([openSettings(), openSettings()]);
    assert.deepEqual(calls, [
      ['contexts', { contextTypes: ['TAB'] }],
      ['create', { url, active: true }], ['focus', 3, { focused: true }],
    ]);
    calls.length = 0; contexts = [{ tabId: 20, windowId: 7, documentUrl: url + '#data' }];
    await openSettings();
    assert.deepEqual(calls.slice(1), [['update', 20, { active: true }], ['focus', 7, { focused: true }]]);
    calls.length = 0; closed = true;
    await openSettings();
    assert.deepEqual(calls.slice(1), [['update', 20, { active: true }], ['create', { url, active: true }], ['focus', 3, { focused: true }]]);
    calls.length = 0; discoveryFails = true;
    await openSettings();
    assert.deepEqual(calls.slice(1), [['create', { url, active: true }], ['focus', 3, { focused: true }]]);
  } finally { globalThis.chrome = old; }
});

test('an opening failure is reported and does not block a subsequent click', async () => {
  const old = globalThis.chrome;
  let fails = true;
  globalThis.chrome = {
    runtime: { getURL: () => 'chrome-extension://kgesture/options.html', getContexts: async () => [] },
    tabs: { create: async () => { if (fails) throw new Error('Cannot create tab'); return { windowId: 1 }; } },
    windows: { update: async () => ({}) },
  } as unknown as typeof chrome;
  try {
    await assert.rejects(openSettings(), /Cannot create tab/);
    fails = false; await openSettings();
  } finally { globalThis.chrome = old; }
});
