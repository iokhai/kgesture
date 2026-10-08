import test from 'node:test';
import assert from 'node:assert/strict';
import { scrollToEdge } from '../src/content/scroll';

function fixture() {
  const view = {
    getComputedStyle: (element: Element) => (element as unknown as FakeElement).style,
    get scrollY() { return (doc.scrollingElement as unknown as FakeElement).scrollTop; },
    scrollTo({ top }: ScrollToOptions) {
      const root = doc.scrollingElement as unknown as FakeElement;
      root.scrollTop = Math.max(0, Math.min(top!, root.scrollHeight - root.clientHeight));
    },
  };
  const doc = { defaultView: view, scrollingElement: null as unknown as Element, documentElement: null as unknown as Element } as unknown as Document;
  class FakeElement {
    ownerDocument = doc;
    isConnected = true;
    assignedSlot: Element | null = null;
    parentElement: Element | null = null;
    shadowHost: Element | null = null;
    scrollHeight = 1200;
    clientHeight = 200;
    scrollTop = 100;
    style = { overflowY: 'auto', display: 'block', flexDirection: 'row' };
    element(): Element { return this as unknown as Element; }
    getRootNode() { return this.shadowHost ? { host: this.shadowHost } : doc; }
    scrollTo({ top }: ScrollToOptions) { this.scrollTop = top!; }
  }
  const root = new FakeElement(); root.style.overflowY = 'visible'; root.scrollTop = 500;
  Object.assign(doc, { scrollingElement: root.element(), documentElement: root.element() });
  return { FakeElement, doc, root };
}

test('one gesture scrolls both a nested component and the page to the requested edge', () => {
  const { FakeElement, root } = fixture();
  const pane = new FakeElement(); pane.parentElement = root.element();
  const child = new FakeElement(); child.scrollHeight = child.clientHeight; child.parentElement = pane.element();
  assert.equal(scrollToEdge(child.element(), 'top'), true);
  assert.equal(pane.scrollTop, 0); assert.equal(root.scrollTop, 0);
  assert.equal(scrollToEdge(child.element(), 'top'), false);
  pane.scrollTop = 200; root.scrollTop = 200;
  assert.equal(scrollToEdge(child.element(), 'bottom'), true);
  assert.equal(pane.scrollTop, 1000); assert.equal(root.scrollTop, 1000);
});

test('cross shadow hosts and assigned slots to reach the scrolling container', () => {
  const { FakeElement, root } = fixture();
  const pane = new FakeElement(); pane.parentElement = root.element();
  const host = new FakeElement(); host.scrollHeight = host.clientHeight; host.parentElement = pane.element();
  const child = new FakeElement(); child.scrollHeight = child.clientHeight; child.shadowHost = host.element();
  assert.equal(scrollToEdge(child.element(), 'bottom'), true); assert.equal(pane.scrollTop, 1000);
  pane.scrollTop = 100;
  const slot = new FakeElement(); slot.scrollHeight = slot.clientHeight; slot.shadowHost = pane.element();
  child.shadowHost = null; child.assignedSlot = slot.element();
  assert.equal(scrollToEdge(child.element(), 'top'), true); assert.equal(pane.scrollTop, 0);
});

test('reverse-column lists use negative positions for the visual top and zero for the bottom', () => {
  const { FakeElement, root } = fixture();
  const chat = new FakeElement(); chat.style.display = 'flex'; chat.style.flexDirection = 'column-reverse';
  chat.scrollTop = -300; chat.parentElement = root.element();
  assert.equal(scrollToEdge(chat.element(), 'top'), true); assert.equal(chat.scrollTop, -1000);
  assert.equal(scrollToEdge(chat.element(), 'bottom'), true); assert.equal(chat.scrollTop, 0);
  assert.equal(root.scrollTop, 1000);
});

test('programmatically scrolling overflow-hidden containers must not be filtered out', () => {
  const { FakeElement, root } = fixture(); root.scrollTop = 0;
  const pane = new FakeElement(); pane.style.overflowY = 'hidden'; pane.scrollTop = 600; pane.parentElement = root.element();
  const child = new FakeElement(); child.scrollHeight = child.clientHeight; child.parentElement = pane.element();
  assert.equal(scrollToEdge(child.element(), 'top'), true);
  assert.equal(pane.scrollTop, 0);
  assert.equal(scrollToEdge(child.element(), 'bottom'), true);
  assert.equal(pane.scrollTop, 1000);
});

test('a disconnected ancestry still scrolls the window viewport', () => {
  const { FakeElement, root } = fixture();
  const child = new FakeElement(); child.scrollHeight = child.clientHeight;
  assert.equal(scrollToEdge(child.element(), 'top'), true); assert.equal(root.scrollTop, 0);
  assert.equal(scrollToEdge(child.element(), 'bottom'), true); assert.equal(root.scrollTop, 1000);
});

test('a detached starting node falls back to the live document root', () => {
  const { FakeElement, root } = fixture();
  const removed = new FakeElement(); removed.isConnected = false;
  assert.equal(scrollToEdge(removed.element(), 'top'), true);
  assert.equal(root.scrollTop, 0); assert.equal(removed.scrollTop, 100);
});
