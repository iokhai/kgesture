import type messages from '../../public/_locales/en/messages.json';

export type MessageKey = keyof typeof messages;
type ParameterizedKey = {
  [Key in MessageKey]: typeof messages[Key] extends { placeholders: object } ? Key : never;
}[MessageKey];
export type StaticMessageKey = Exclude<MessageKey, ParameterizedKey>;

// Catalogs stay in Chromium's native i18n system; none are bundled into the event path.
export function t(key: StaticMessageKey): string;
export function t(key: ParameterizedKey, substitutions: [string, ...string[]]): string;
export function t(key: MessageKey, substitutions?: string[]): string {
  return (typeof chrome !== 'undefined' ? chrome.i18n?.getMessage(key, substitutions) : '') || key;
}
