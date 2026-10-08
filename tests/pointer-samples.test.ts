import test from 'node:test';
import assert from 'node:assert/strict';
import { Recognizer } from '../src/core/recognizer';
import { processPointerSamples } from '../src/core/pointer-samples';

test('a fast up/down stroke survives a batch whose final position equals the starting position', () => {
  const r = new Recognizer(); r.start(0, 0, 12);
  let samples = 0;
  processPointerSamples({ clientX: 0, clientY: 0,
    getCoalescedEvents: () => [{ clientX: 0, clientY: -30 }, { clientX: 0, clientY: 0 }] },
  (x, y) => { samples++; r.move(x, y); });
  assert.equal(r.pattern, 'UD'); assert.equal(samples, 2);
});
test('ordinary and empty-batch events still contribute their final position', () => {
  for (const event of [{ clientX: 0, clientY: -30 }, { clientX: 0, clientY: -30, getCoalescedEvents: () => [] }]) {
    const r = new Recognizer(); r.start(0, 0, 12);
    processPointerSamples(event, (x, y) => r.move(x, y));
    assert.equal(r.pattern, 'U');
  }
});
test('the dispatched position is consumed when it is newer than the coalesced batch', () => {
  const r = new Recognizer(); r.start(0, 0, 12);
  processPointerSamples({ clientX: 0, clientY: 0, getCoalescedEvents: () => [{ clientX: 0, clientY: -30 }] }, (x, y) => r.move(x, y));
  assert.equal(r.pattern, 'UD');
});
