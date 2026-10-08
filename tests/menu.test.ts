import test from 'node:test';
import assert from 'node:assert/strict';
import { MenuGate } from '../src/core/menu';
test('macOS press menu is suppressed, second stationary click is allowed', () => {
  const m = new MenuGate(); m.begin(1000); assert.equal(m.shouldSuppress(1001, true, true), true);
  m.finish(1100, false); m.begin(1200); assert.equal(m.shouldSuppress(1201, true, true), false);
});
test('Windows stationary click menu remains native, gesture release menu is suppressed once', () => {
  const m = new MenuGate(); m.begin(1000); m.finish(1100, false);
  assert.equal(m.shouldSuppress(1101, false, false), false);
  m.begin(2000); m.finish(2100, true);
  assert.equal(m.shouldSuppress(2101, false, false), true);
  assert.equal(m.shouldSuppress(2200, false, false), false);
});
test('a later click never inherits stale gesture suppression', () => {
  const m = new MenuGate(); m.begin(1000); m.finish(1100, true); m.begin(1300);
  assert.equal(m.shouldSuppress(1301, false, true), false);
  assert.equal(m.shouldSuppress(1301, true, true), true);
});
