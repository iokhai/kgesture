import { MAX_DIRECTIONS } from '../shared/settings';

// Fixed-size state. No point history, trigonometry, promises, or per-sample objects.
export class Recognizer {
  private x = 0;
  private y = 0;
  private thresholdSquared = 144;
  private last = '';
  pattern = '';
  overflow = false;

  start(x: number, y: number, threshold: number): void {
    this.x = x; this.y = y;
    this.thresholdSquared = threshold * threshold;
    this.pattern = ''; this.last = ''; this.overflow = false;
  }

  move(x: number, y: number): boolean {
    if (this.overflow) return false;
    const dx = x - this.x, dy = y - this.y;
    if ((dx === 0 && dy === 0) || dx * dx + dy * dy < this.thresholdSquared) return false;
    // A 20% axis dead zone rejects ambiguous diagonals rather than alternating directions.
    const ax = Math.abs(dx), ay = Math.abs(dy);
    let direction: string;
    if (ax >= ay * 1.2) direction = dx > 0 ? 'R' : 'L';
    else if (ay >= ax * 1.2) direction = dy > 0 ? 'D' : 'U';
    else return false;
    // Rejected diagonals must not consume displacement from the confirmed anchor.
    this.x = x; this.y = y;
    if (direction === this.last) return false;
    if (this.pattern.length === MAX_DIRECTIONS) { this.overflow = true; return true; }
    this.last = direction;
    this.pattern += direction;
    return true;
  }
}
