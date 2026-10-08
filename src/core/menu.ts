// macOS/Linux can emit contextmenu on press, before a gesture can be recognized.
// A second stationary right click within 500ms explicitly requests the native menu.
export class MenuGate {
  private lastClick = -Infinity;
  private suppressUntil = 0;
  begin(now: number): void { this.suppressUntil = 0; if (now - this.lastClick > 500) this.lastClick = -Infinity; }
  finish(now: number, moved: boolean): void {
    if (moved) { this.suppressUntil = now + 500; this.lastClick = -Infinity; }
    else this.lastClick = now;
  }
  shouldSuppress(now: number, earlyMenu: boolean, tracking: boolean): boolean {
    if (now < this.suppressUntil) { this.suppressUntil = 0; return true; }
    if (!earlyMenu || !tracking) return false;
    if (now - this.lastClick <= 500) { this.lastClick = -Infinity; return false; }
    return true;
  }
}
