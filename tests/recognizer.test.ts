import test from 'node:test';
import assert from 'node:assert/strict';
import { Recognizer } from '../src/core/recognizer';

test('ignores jitter and recognizes a slow accumulated movement', () => {
  const r = new Recognizer(); r.start(100, 100, 12);
  for (let x = 101; x < 112; x++) assert.equal(r.move(x, 100), false);
  assert.equal(r.pattern, ''); assert.equal(r.move(112, 100), true); assert.equal(r.pattern, 'R');
});
test('straight movement collapses repeated directions and preserves corners', () => {
  const r = new Recognizer(); r.start(0, 0, 10);
  for (let x = 10; x <= 100; x += 10) r.move(x, 0);
  assert.equal(r.pattern, 'R'); r.move(100, 20); r.move(80, 20); r.move(80, 0);
  assert.equal(r.pattern, 'RDLU');
});
test('diagonal dead zone does not generate a jittering alternating command', () => {
  const r = new Recognizer(); r.start(0, 0, 10);
  for (let i = 12; i < 1000; i += 12) r.move(i, i + (i % 2));
  assert.equal(r.pattern, '');
});
test('overflow rejects a valid prefix, remains bounded, and resets on next gesture', () => {
  const r = new Recognizer(); r.start(0, 0, 10);
  for (let i = 0; i < 100_000; i++) r.move(i % 2 ? 0 : 20, 0);
  assert.equal(r.pattern.length, 16); assert.equal(r.overflow, true);
  r.start(0, 0, 10); r.move(0, -20); assert.equal(r.pattern, 'U'); assert.equal(r.overflow, false);
});
test('reset prevents state leaking between gestures', () => {
  const r = new Recognizer(); r.start(0, 0, 12); r.move(30, 0);
  r.start(500, 500, 20); assert.equal(r.pattern, ''); r.move(500, 485); assert.equal(r.pattern, '');
  r.move(500, 480); assert.equal(r.pattern, 'U');
});
test('ambiguous samples preserve displacement for a valid upward stroke and its reversal', () => {
  const r = new Recognizer(); r.start(0, 0, 12);
  assert.equal(r.move(10, -10), false);
  r.move(10, -16); assert.equal(r.pattern, 'U');
  assert.equal(r.move(20, -6), false);
  r.move(20, 0); assert.equal(r.pattern, 'UD');
});
test('no distance filtering recognizes small moves but never creates a direction from a stationary sample', () => {
  const r = new Recognizer(); r.start(100, 100, 0);
  assert.equal(r.move(100, 100), false); assert.equal(r.pattern, '');
  assert.equal(r.move(100, 99), true); assert.equal(r.pattern, 'U');
  assert.equal(r.move(100, 99), false); assert.equal(r.pattern, 'U');
  assert.equal(r.move(100, 100), true); assert.equal(r.pattern, 'UD');
  r.start(100, 100, 12); assert.equal(r.move(100, 99), false); assert.equal(r.pattern, '');
});
