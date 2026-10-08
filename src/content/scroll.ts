type Edge = 'top' | 'bottom';

function composedParent(element: Element): Element | null {
  if (element.assignedSlot) return element.assignedSlot;
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode();
  return 'host' in root ? (root as ShadowRoot).host : null;
}

// Traverse only the gesture's ancestry, after release. No page scans or idle work.
export function scrollToEdge(element: Element | null, edge: Edge, doc = element?.ownerDocument ?? document): boolean {
  const view = doc.defaultView;
  if (!view) return false;
  const root = doc.scrollingElement ?? doc.documentElement;
  // Match the original action: scroll the viewport AND every ancestor, including
  // overflow:hidden containers that the page scrolls programmatically.
  const beforeViewport = view.scrollY;
  view.scrollTo({ top: edge === 'top' ? 0 : Math.max(root?.scrollHeight ?? 0, doc.body?.scrollHeight ?? 0), behavior: 'instant' });
  let moved = Math.abs(view.scrollY - beforeViewport) > 0.5;
  let current: Element | null = element?.isConnected ? element : root;
  while (current) {
    const range = current.scrollHeight - current.clientHeight;
    if (range > 0) {
      const style = view.getComputedStyle(current);
      // Reverse-column chat lists use negative scrollTop values.
      const reverse = /^(inline-)?flex$/.test(style.display) && style.flexDirection === 'column-reverse';
      const top = edge === 'top' ? (reverse ? -range : 0) : (reverse ? 0 : range);
      const before = current.scrollTop;
      if (Math.abs(before - top) > 0.5) {
        current.scrollTo({ top, behavior: 'instant' });
        moved ||= Math.abs(current.scrollTop - before) > 0.5;
      }
    }
    current = composedParent(current);
  }
  return moved;
}
