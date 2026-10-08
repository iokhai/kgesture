import test from 'node:test';
import assert from 'node:assert/strict';
import { Overlay } from '../src/content/overlay';
import { DEFAULT_SETTINGS } from '../src/shared/settings';

test('feedback batching preserves hints and strokes without repeated hint-only frames', async t => {
  const names = ['document', 'innerWidth', 'innerHeight', 'requestAnimationFrame', 'cancelAnimationFrame'] as const;
  const saved = names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const);
  const frames = new Map<number, FrameRequestCallback>(); let requested = 0;
  const lines: number[][] = [], origins: number[][] = [];
  const context = { beginPath() {}, moveTo(x: number, y: number) { origins.push([x, y]); }, lineTo(x: number, y: number) { lines.push([x, y]); }, stroke() {} };
  class Node {
    style = { cssText: '' }; dataset = {}; children: Node[] = []; parent: Node | null = null; shadow: Node | null = null;
    text = ''; writes = 0;
    constructor(public tag: string) {}
    append(node: Node) { this.children.push(node); node.parent = this; }
    attachShadow() { return this.shadow = new Node('shadow'); }
    getContext() { return context; }
    set textContent(value: string) { this.text = value; this.writes++; }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); }
  }
  const root = new Node('html');
  const values = {
    document: { documentElement: root, createElement: (tag: string) => new Node(tag) }, innerWidth: 1440, innerHeight: 1050,
    requestAnimationFrame: (callback: FrameRequestCallback) => { frames.set(++requested, callback); return requested; },
    cancelAnimationFrame: (id: number) => frames.delete(id),
  };
  const flush = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(0)); };
  const hint = () => root.children[0]!.shadow!.children.find(node => node.tag === 'div')!;
  try {
    for (const name of names) Object.defineProperty(globalThis, name, { configurable: true, value: values[name] });
    await t.test('unchanged hint-only movement needs one frame, while changed patterns and actions update', () => {
      const overlay = new Overlay(); const before = requested;
      overlay.begin(10, 10, { ...DEFAULT_SETTINGS, showTrail: false });
      for (let i = 0; i < 1000; i++) { overlay.point(10, 10 - i, 'U', 'scrollTop'); flush(); }
      assert.equal(requested - before, 1); assert.match(hint().text, /^↑\s/); assert.equal(hint().writes, 1);
      overlay.point(10, 40, 'UD', 'scrollBottom'); flush(); assert.match(hint().text, /^↑↓\s/);
      const boundText = hint().text;
      overlay.point(10, 40, 'UD', undefined); flush(); assert.notEqual(hint().text, boundText);
      overlay.clear(); assert.equal(root.children.length, 0);
    });
    await t.test('trail-only mode still batches all points and retains the newest point under overload', () => {
      const overlay = new Overlay(); lines.length = 0;
      overlay.begin(10, 20, { ...DEFAULT_SETTINGS, showHint: false });
      for (let i = 0; i < 10000; i++) overlay.point(i, i, 'R', 'forward');
      assert.equal(frames.size, 1); assert.equal(root.children[0]!.shadow!.children.length, 1);
      flush(); assert.equal(lines.length, 2048); assert.deepEqual(lines.at(-1), [9999, 9999]);
      assert.deepEqual(origins.at(-1), [10, 20]); overlay.clear();
    });
    await t.test('clearing cancels queued drawing and the next gesture starts from its own origin', () => {
      const overlay = new Overlay();
      overlay.begin(10, 10, DEFAULT_SETTINGS); overlay.point(10, 0, 'U', 'scrollTop');
      overlay.clear(); assert.equal(frames.size, 0); assert.equal(root.children.length, 0);
      overlay.begin(200, 300, DEFAULT_SETTINGS); overlay.point(200, 280, 'U', 'scrollTop'); flush();
      assert.deepEqual(origins.at(-1), [200, 300]); assert.match(hint().text, /^↑\s/); overlay.clear();
    });
    await t.test('disabled feedback creates no overlay and schedules no frames', () => {
      const overlay = new Overlay(); const before = requested;
      overlay.begin(10, 10, { ...DEFAULT_SETTINGS, showTrail: false, showHint: false });
      for (let i = 0; i < 1000; i++) overlay.point(10, -i, 'U', 'scrollTop');
      assert.equal(root.children.length, 0); assert.equal(requested, before); overlay.clear();
    });
  } finally {
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});
