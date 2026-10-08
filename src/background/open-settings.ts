let opening: Promise<void> | undefined;

// Use explicit tab navigation so toolbar clicks have the same behavior across browsers.
export function openSettings(): Promise<void> {
  if (opening) return opening;
  opening = focusSettings().finally(() => { opening = undefined; });
  return opening;
}

async function focusSettings(): Promise<void> {
  const url = chrome.runtime.getURL('options.html');
  let contexts: chrome.runtime.ExtensionContext[] = [];
  try { contexts = await chrome.runtime.getContexts({ contextTypes: ['TAB'] }); }
  catch { /* Opening a new tab still works if context discovery is unavailable. */ }
  const current = contexts.find(context => context.tabId >= 0 && context.documentUrl?.split(/[?#]/)[0] === url);
  let tab: chrome.tabs.Tab | undefined;
  if (current) {
    try { tab = await chrome.tabs.update(current.tabId, { active: true }); }
    catch { /* The tab may have closed after context discovery. */ }
  }
  tab ??= await chrome.tabs.create({ url, active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
}
