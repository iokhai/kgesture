import { ACTIONS, arrows } from '../shared/actions';
import type { ActionId } from '../shared/actions';
import type { Settings } from '../shared/settings';
import { t } from '../shared/i18n';

const unboundLabel = t('unboundGesture');

export class Overlay {
  private host: HTMLDivElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private hint: HTMLDivElement | null = null;
  private buffer: Float32Array | null = null;
  private count = 0;
  private frame = 0;
  private x = 0;
  private y = 0;
  private pattern = '';
  private action: ActionId | undefined;
  private renderedHint = '';
  private hintDirty = false;
  private visible = false;
  private settings: Settings | null = null;

  begin(x: number, y: number, settings: Settings): void {
    this.clear();
    this.x = x; this.y = y; this.settings = settings;
    this.visible = settings.showTrail || settings.showHint;
  }
  private mount(): void {
    const settings = this.settings!;
    if (this.host || (!settings.showTrail && !settings.showHint)) return;
    this.host = document.createElement('div');
    this.host.dataset.kgestureOverlay = '';
    this.host.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important;contain:strict!important;';
    const root = this.host.attachShadow({ mode: 'closed' });
    if (settings.showTrail) {
      this.buffer = new Float32Array(4096);
      this.canvas = document.createElement('canvas');
      const width = innerWidth, height = innerHeight;
      // CSS-pixel backing store avoids a DPR-squared fullscreen allocation.
      this.canvas.width = width; this.canvas.height = height;
      this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
      this.ctx = this.canvas.getContext('2d');
      if (this.ctx) {
        this.ctx.strokeStyle = settings.trailColor; this.ctx.lineWidth = settings.trailWidth;
        this.ctx.lineCap = 'round'; this.ctx.lineJoin = 'round';
      }
      root.append(this.canvas);
    }
    if (settings.showHint) {
      this.hint = document.createElement('div');
      this.hint.style.cssText = 'position:absolute;bottom:44px;left:50%;transform:translateX(-50%);padding:12px 20px;border-radius:14px;background:#151524;color:#fff;font:500 15px system-ui,sans-serif;box-shadow:0 6px 30px #0003;white-space:nowrap';
      root.append(this.hint);
    }
    document.documentElement.append(this.host);
  }
  point(x: number, y: number, pattern: string, action: ActionId | undefined): void {
    if (!pattern || !this.visible) return;
    if (!this.host) this.mount();
    if (!this.host) return;
    if (this.hint && (pattern !== this.pattern || action !== this.action)) {
      this.pattern = pattern; this.action = action; this.hintDirty = true;
    }
    if (this.ctx && this.buffer) {
      // Under overload retain the latest point, bounded independently of gesture duration.
      const index = Math.min(this.count, this.buffer.length - 2);
      this.buffer[index] = x; this.buffer[index + 1] = y;
      this.count = Math.min(this.count + 2, this.buffer.length);
    }
    if (!this.frame && (this.count || this.hintDirty)) this.frame = requestAnimationFrame(this.draw);
  }
  private draw = (): void => {
    this.frame = 0;
    if (this.ctx && this.buffer && this.count) {
      this.ctx.beginPath(); this.ctx.moveTo(this.x, this.y);
      for (let i = 0; i < this.count; i += 2) this.ctx.lineTo(this.buffer[i]!, this.buffer[i + 1]!);
      this.x = this.buffer[this.count - 2]!; this.y = this.buffer[this.count - 1]!;
      this.ctx.stroke(); this.count = 0;
    }
    if (this.hint && this.hintDirty) {
      this.hintDirty = false;
      const text = `${arrows(this.pattern)}  ${this.action ? ACTIONS[this.action] : unboundLabel}`;
      if (text !== this.renderedHint) { this.hint.textContent = text; this.renderedHint = text; }
    }
  };
  clear(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0; this.count = 0;
    this.host?.remove(); this.host = null; this.canvas = null; this.ctx = null; this.hint = null;
    this.buffer = null;
    this.settings = null; this.visible = false;
    this.renderedHint = ''; this.pattern = ''; this.action = undefined; this.hintDirty = false;
    // Release the fullscreen canvas immediately; no retained backing store between gestures.
  }
}
