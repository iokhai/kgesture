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
  let current: Element | null = element?.isConnected ? element : root;
  let visitedRoot = false;
  while (current) {
    visitedRoot ||= current === root;
    const range = current.scrollHeight - current.clientHeight;
    if (range > 0) {
      const style = view.getComputedStyle(current);
      if (current === root || /^(auto|scroll|overlay)$/.test(style.overflowY)) {
        // Reverse-column chat lists use negative scrollTop values.
        const reverse = /^(inline-)?flex$/.test(style.display) && style.flexDirection === 'column-reverse';
        const top = edge === 'top' ? (reverse ? -range : 0) : (reverse ? 0 : range);
        const before = current.scrollTop;
        if (Math.abs(before - top) > 0.5) {
          current.scrollTo({ top, behavior: 'instant' });
          if (Math.abs(current.scrollTop - before) > 0.5) return true;
        }
      }
    }
    current = composedParent(current);
  }
  // A detached start node or an unusual document tree can omit the viewport root.
  if (!visitedRoot) {
    const before = view.scrollY;
    view.scrollTo({ top: edge === 'top' ? 0 : Math.max(root?.scrollHeight ?? 0, doc.body?.scrollHeight ?? 0), behavior: 'instant' });
    return Math.abs(view.scrollY - before) > 0.5;
  }
  return false;
}
