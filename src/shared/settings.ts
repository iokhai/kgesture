import { arrows, isAction } from './actions';
import type { ActionId } from './actions';
import { t } from './i18n';

export interface Binding { pattern: string; action: ActionId }
export interface Settings {
  version: 1;
  enabled: boolean;
  distanceFilter: boolean;
  threshold: number;
  showTrail: boolean;
  showHint: boolean;
  trailColor: string;
  trailWidth: number;
  excludedHosts: string[];
  bindings: Binding[];
}
export const STORAGE_KEY = 'settings';
export const DEFAULT_SETTINGS: Settings = {
  version: 1, enabled: true, distanceFilter: true, threshold: 12, showTrail: true, showHint: true,
  trailColor: '#7c6cff', trailWidth: 3, excludedHosts: [],
  bindings: [
    { pattern: 'L', action: 'back' }, { pattern: 'R', action: 'forward' },
    { pattern: 'D', action: 'newTab' }, { pattern: 'DU', action: 'reload' },
    { pattern: 'DR', action: 'closeTab' }, { pattern: 'LU', action: 'restoreTab' },
    { pattern: 'UL', action: 'previousTab' }, { pattern: 'UR', action: 'nextTab' },
    { pattern: 'U', action: 'scrollTop' }, { pattern: 'UD', action: 'scrollBottom' },
    { pattern: 'RDLU', action: 'options' },
  ],
};
export const MAX_DIRECTIONS = 16;
export function validPattern(pattern: unknown): pattern is string {
  return typeof pattern === 'string' && /^[UDLR]{1,16}$/.test(pattern) && !/(.)\1/.test(pattern);
}
function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function validateSettings(value: unknown): string | null {
  const s = object(value);
  if (s.version !== 1) return t('invalidVersion');
  for (const key of ['enabled', 'showTrail', 'showHint']) if (typeof s[key] !== 'boolean') return t('invalidSwitch');
  // Older settings did not include this switch; preserve their distance filtering.
  if (s.distanceFilter !== undefined && typeof s.distanceFilter !== 'boolean') return t('invalidSwitch');
  if (typeof s.threshold !== 'number' || !Number.isFinite(s.threshold) || s.threshold < 4 || s.threshold > 64) return t('invalidThreshold');
  if (typeof s.trailWidth !== 'number' || !Number.isFinite(s.trailWidth) || s.trailWidth < 1 || s.trailWidth > 12) return t('invalidTrailWidth');
  if (typeof s.trailColor !== 'string' || !/^#[0-9a-f]{6}$/i.test(s.trailColor)) return t('invalidTrailColor');
  if (!Array.isArray(s.excludedHosts) || s.excludedHosts.length > 256 || s.excludedHosts.some(h => typeof h !== 'string' || !/^(\*\.)?[a-z0-9.-]+(?::\d+)?$/i.test(h) || h.length > 253)) return t('invalidHosts');
  if (!Array.isArray(s.bindings) || s.bindings.length > 128) return t('tooManyGestures');
  const patterns = new Set<string>();
  for (const item of s.bindings) {
    const binding = object(item);
    if (!validPattern(binding.pattern) || !isAction(binding.action)) return t('invalidPattern');
    if (patterns.has(binding.pattern)) return t('duplicatePattern', [arrows(binding.pattern)]);
    patterns.add(binding.pattern);
  }
  return null;
}
export function normalizeSettings(value: unknown): Settings {
  if (validateSettings(value)) return structuredClone(DEFAULT_SETTINGS);
  const s = value as Settings;
  return { version: 1, enabled: s.enabled, distanceFilter: s.distanceFilter ?? true, threshold: s.threshold, showTrail: s.showTrail, showHint: s.showHint,
    trailColor: s.trailColor, trailWidth: s.trailWidth, excludedHosts: s.excludedHosts.map(h => h.toLowerCase()),
    bindings: s.bindings.map(b => ({ pattern: b.pattern, action: b.action })) };
}
export function recognitionThreshold(settings: Pick<Settings, 'distanceFilter' | 'threshold'>): number {
  return settings.distanceFilter ? settings.threshold : 0;
}
export function hostExcluded(host: string, list: readonly string[]): boolean {
  return list.some(rule => rule.startsWith('*.')
    ? host === rule.slice(2) || host.endsWith(`.${rule.slice(2)}`) : host === rule);
}
