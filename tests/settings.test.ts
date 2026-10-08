import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, hostExcluded, normalizeSettings, recognitionThreshold, validateSettings, validPattern } from '../src/shared/settings';
import { safeLink } from '../src/background/actions';

test('defaults validate and normalized settings do not alias input', () => {
  assert.equal(validateSettings(DEFAULT_SETTINGS), null);
  const result = normalizeSettings(DEFAULT_SETTINGS); result.bindings[0]!.pattern = 'D';
  assert.equal(DEFAULT_SETTINGS.bindings[0]!.pattern, 'L');
});
test('malformed imports and duplicate gestures are rejected', () => {
  for (const value of [null, [], { version: 2 }, { ...DEFAULT_SETTINGS, threshold: NaN },
    { ...DEFAULT_SETTINGS, bindings: [{ pattern: 'L', action: 'back' }, { pattern: 'L', action: 'reload' }] },
    { ...DEFAULT_SETTINGS, bindings: [{ pattern: 'L', action: '__proto__' }] },
    { ...DEFAULT_SETTINGS, excludedHosts: ['https://example.com/path'] }]) assert.ok(validateSettings(value));
  assert.deepEqual(normalizeSettings(null), DEFAULT_SETTINGS);
});
test('empty bindings intentionally disables all commands', () => {
  const s = normalizeSettings({ ...DEFAULT_SETTINGS, bindings: [] }); assert.equal(s.bindings.length, 0);
});
test('legacy settings preserve their threshold and bindings with filtering enabled', () => {
  const { distanceFilter: _, ...legacy } = structuredClone(DEFAULT_SETTINGS);
  legacy.threshold = 28;
  assert.equal(validateSettings(legacy), null);
  assert.deepEqual(normalizeSettings(legacy), { ...legacy, distanceFilter: true });
});
test('distance filtering can be disabled without losing the stored threshold on export and import', () => {
  const settings = { ...DEFAULT_SETTINGS, distanceFilter: false, threshold: 28 };
  assert.equal(validateSettings(settings), null);
  const imported = normalizeSettings(JSON.parse(JSON.stringify(settings)));
  assert.equal(imported.distanceFilter, false); assert.equal(imported.threshold, 28);
  assert.equal(recognitionThreshold(imported), 0);
  assert.equal(recognitionThreshold({ ...imported, distanceFilter: true }), 28);
  for (const distanceFilter of [null, 'false', 0]) assert.ok(validateSettings({ ...settings, distanceFilter }));
});
test('patterns reject repeats and bound command length', () => {
  assert.equal(validPattern('RDLU'), true);
  for (const pattern of ['', 'RR', 'hello', 'L'.repeat(17), 4]) assert.equal(validPattern(pattern), false);
});
test('wildcards respect domain boundaries and include the apex', () => {
  assert.equal(hostExcluded('example.com', ['*.example.com']), true);
  assert.equal(hostExcluded('a.b.example.com', ['*.example.com']), true);
  assert.equal(hostExcluded('notexample.com', ['*.example.com']), false);
  assert.equal(hostExcluded('sub.example.com', ['example.com']), false);
});
test('link actions cannot open javascript, data, extension, or file URLs', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'chrome://settings', 'file:///tmp/test', 'invalid', null]) assert.equal(safeLink(url), undefined);
  assert.equal(safeLink('https://example.com'), 'https://example.com/');
});
