import { t } from '../shared/i18n';
import type { StaticMessageKey } from '../shared/i18n';

export function localize(): void {
  document.documentElement.lang = t('localeTag');
  for (const element of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    element.textContent = t(element.dataset.i18n as StaticMessageKey);
  }
  for (const element of document.querySelectorAll<HTMLElement>('[data-i18n-aria-label]')) {
    element.setAttribute('aria-label', t(element.dataset.i18nAriaLabel as StaticMessageKey));
  }
}
