import { t } from './i18n';

export const ACTIONS = {
  back: t('actionBack'), forward: t('actionForward'), reload: t('actionReload'), reloadHard: t('actionReloadHard'),
  scrollTop: t('actionScrollTop'), scrollBottom: t('actionScrollBottom'), stop: t('actionStop'),
  newTab: t('actionNewTab'), newBackgroundTab: t('actionNewBackgroundTab'),
  closeTab: t('actionCloseTab'), restoreTab: t('actionRestoreTab'),
  duplicateTab: t('actionDuplicateTab'), nextTab: t('actionNextTab'), previousTab: t('actionPreviousTab'),
  togglePin: t('actionTogglePin'), closeLeft: t('actionCloseLeft'),
  closeRight: t('actionCloseRight'), options: t('actionOptions'),
} as const;
export type ActionId = keyof typeof ACTIONS;
export function isAction(value: unknown): value is ActionId {
  return typeof value === 'string' && Object.hasOwn(ACTIONS, value);
}
const directionArrows: Record<string, string> = { U: '↑', D: '↓', L: '←', R: '→' };
const directionPattern = /[UDLR]/g;
const replaceDirection = (direction: string): string => directionArrows[direction]!;
export function arrows(pattern: string): string {
  return pattern.replace(directionPattern, replaceDirection);
}
