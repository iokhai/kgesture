import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS } from '../src/shared/settings';

type Input = {
  isTrusted: boolean; button: number; buttons: number; clientX: number; clientY: number;
  pointerType: string; ctrlKey: boolean; shiftKey: boolean; key?: string;
  composedPath: () => unknown[];
};
class Events {
  listeners = new Map<string, Set<(event: Input) => void>>();
  addEventListener(type: string, listener: (event: Input) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }
  removeEventListener(type: string, listener: (event: Input) => void) { this.listeners.get(type)?.delete(listener); }
  dispatch(type: string, event: Input) { for (const listener of [...this.listeners.get(type) ?? []]) listener(event); }
}

test('content events execute the confirmed command at right-button release', async t => {
  const names = ['window', 'document', 'location', 'navigator', 'Element', 'HTMLAnchorElement', 'chrome'] as const;
  const saved = names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const);
  const view = new Events();
  const doc = Object.assign(new Events(), { hidden: false });
  class Element {
    ownerDocument = doc; isConnected = true; assignedSlot = null; parentElement = null;
    scrollHeight = 1200; clientHeight = 200; scrollTop = 600;
    closest() { return null; }
    getRootNode() { return doc; }
    scrollTo({ top }: ScrollToOptions) { this.scrollTop = Math.max(0, Math.min(top!, 1000)); }
  }
  const root = new Element();
  const settings = { ...DEFAULT_SETTINGS, showTrail: false, showHint: false };
  let changed!: (changes: Record<string, chrome.storage.StorageChange>, area: string) => void;
  Object.assign(doc, { defaultView: view, scrollingElement: root, documentElement: root, body: root });
  Object.assign(view, {
    getComputedStyle: () => ({ display: 'block', flexDirection: 'row' }),
    scrollTo: (options: ScrollToOptions) => root.scrollTo(options),
  });
  Object.defineProperty(view, 'scrollY', { get: () => root.scrollTop });
  const replacements = {
    window: view, document: doc, location: { host: 'example.com' }, navigator: { platform: 'MacIntel' }, Element,
    HTMLAnchorElement: class extends Element {},
    chrome: {
      runtime: { id: 'kgesture' },
      i18n: { getMessage: (key: string) => key },
      storage: {
        local: { get: async () => ({ settings }) },
        onChanged: { addListener(listener: typeof changed) { changed = listener; } },
      },
    },
  };
  const input = (changes: Partial<Input> = {}): Input => ({
    isTrusted: true, button: 2, buttons: 2, clientX: 450, clientY: 400,
    pointerType: 'mouse', ctrlKey: false, shiftKey: false, composedPath: () => [root], ...changes,
  });
  const beginUp = () => {
    root.scrollTop = 600;
    view.dispatch('mousedown', input());
    view.dispatch('pointermove', input({ button: -1, clientY: 330 }));
  };
  try {
    for (const name of names) Object.defineProperty(globalThis, name, { configurable: true, value: replacements[name] });
    await import('../src/content/index');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(view.listeners.get('mousedown')?.size, 1, 'content initialization failed');
    await t.test('release-only drift cannot turn the confirmed U into an unbound UR', () => {
      for (const clientX of [450, 455, 465, 500]) {
        beginUp();
        view.dispatch('mouseup', input({ clientX, clientY: 330, buttons: 0 }));
        assert.equal(root.scrollTop, 0);
      }
    });
    await t.test('right-button release works while another mouse button stays held', () => {
      beginUp();
      view.dispatch('mousedown', input({ button: 0, buttons: 3 }));
      // Chorded release emits pointermove for the button change before mouseup.
      view.dispatch('pointermove', input({ button: 2, buttons: 1, clientY: 330 }));
      view.dispatch('mouseup', input({ clientY: 330, buttons: 1 }));
      assert.equal(root.scrollTop, 0);
    });
    await t.test('movement samples still confirm a real turn before release', () => {
      beginUp();
      view.dispatch('pointermove', input({ button: -1, clientY: 410 }));
      view.dispatch('mouseup', input({ clientY: 410, buttons: 0 }));
      assert.equal(root.scrollTop, 1000);
    });
    await t.test('release coordinates alone do not create a gesture from a stationary click', () => {
      root.scrollTop = 600;
      view.dispatch('mousedown', input());
      view.dispatch('mouseup', input({ clientY: 330, buttons: 0 }));
      assert.equal(root.scrollTop, 600);
    });
    await t.test('Escape and loss of focus cancel the command and remove temporary listeners', () => {
      for (const type of ['keydown', 'blur']) {
        beginUp(); view.dispatch(type, input({ key: 'Escape' }));
        view.dispatch('mouseup', input({ clientY: 330, buttons: 0 }));
        assert.equal(root.scrollTop, 600);
        assert.equal(view.listeners.get('pointermove')?.size, 0);
        assert.equal(view.listeners.get('mouseup')?.size, 0);
      }
    });
    await t.test('untrusted releases and non-mouse moves do not execute or corrupt a gesture', () => {
      beginUp();
      view.dispatch('pointermove', input({ pointerType: 'touch', clientX: 500, clientY: 330 }));
      view.dispatch('mouseup', input({ isTrusted: false, clientY: 330, buttons: 0 }));
      assert.equal(root.scrollTop, 600);
      view.dispatch('mouseup', input({ clientY: 330, buttons: 0 }));
      assert.equal(root.scrollTop, 0);
    });
    await t.test('the distance switch changes live recognition of a one-pixel upward stroke', () => {
      for (const distanceFilter of [false, true]) {
        changed({ settings: { newValue: { ...settings, distanceFilter } } }, 'local');
        root.scrollTop = 600;
        view.dispatch('mousedown', input());
        view.dispatch('pointermove', input({ button: -1, clientY: 399 }));
        view.dispatch('mouseup', input({ clientY: 399, buttons: 0 }));
        assert.equal(root.scrollTop, distanceFilter ? 600 : 0);
      }
    });
  } finally {
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});
