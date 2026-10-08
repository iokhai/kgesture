import { Recognizer } from '../core/recognizer';
import { arrows } from '../shared/actions';
import { t } from '../shared/i18n';

interface Style { threshold: number; trailColor: string; trailWidth: number }
interface Recording {
  commit: (pattern: string) => void;
  conflict: (pattern: string) => string | undefined;
}

export class GestureRecorder {
  private dialog = document.getElementById('recorder') as HTMLDialogElement;
  private canvas = document.getElementById('record-canvas') as HTMLCanvasElement;
  private context = this.canvas.getContext('2d')!;
  private result = document.getElementById('record-pattern') as HTMLOutputElement;
  private status = document.getElementById('record-status')!;
  private use = document.getElementById('record-use') as HTMLButtonElement;
  private recognizer = new Recognizer();
  private recording: Recording | null = null;
  private pointer: number | null = null;
  private completed = false;
  private x = 0;
  private y = 0;

  constructor(private style: () => Style) {
    document.getElementById('record-cancel')!.addEventListener('click', () => this.close());
    document.getElementById('record-reset')!.addEventListener('click', () => this.reset());
    this.use.addEventListener('click', () => {
      if (!this.completed || this.use.disabled || !this.recording) return;
      const pattern = this.recognizer.pattern;
      const commit = this.recording.commit;
      this.close();
      commit(pattern);
    });
    this.dialog.addEventListener('close', () => { this.reset(); this.recording = null; });
    this.dialog.addEventListener('cancel', () => this.reset());
    this.canvas.addEventListener('contextmenu', event => event.preventDefault());
    this.canvas.addEventListener('pointerdown', event => this.start(event));
    this.canvas.addEventListener('pointermove', event => this.move(event));
    this.canvas.addEventListener('pointerup', event => this.finish(event));
    this.canvas.addEventListener('pointercancel', event => { if (event.pointerId === this.pointer) this.reset(); });
    this.canvas.addEventListener('lostpointercapture', event => { if (event.pointerId === this.pointer) this.reset(); });
    window.addEventListener('blur', () => { if (this.pointer !== null) this.reset(); });
  }

  open(recording: Recording): void {
    this.recording = recording;
    this.reset();
    this.dialog.showModal();
  }

  close(): void {
    this.reset();
    this.recording = null;
    if (this.dialog.open) this.dialog.close();
  }

  private reset(): void {
    const pointer = this.pointer;
    this.pointer = null;
    if (pointer !== null && this.canvas.hasPointerCapture(pointer)) this.canvas.releasePointerCapture(pointer);
    this.completed = false;
    this.use.disabled = true;
    this.result.textContent = '';
    this.status.textContent = '';
    this.status.classList.remove('error');
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private start(event: PointerEvent): void {
    if (this.pointer !== null || (event.button !== 0 && event.button !== 2)) return;
    event.preventDefault();
    this.reset();
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.round(rect.width);
    this.canvas.height = Math.round(rect.height);
    this.x = event.clientX - rect.left; this.y = event.clientY - rect.top;
    const style = this.style();
    this.recognizer.start(this.x, this.y, style.threshold);
    this.context.strokeStyle = style.trailColor; this.context.lineWidth = style.trailWidth;
    this.context.lineCap = 'round'; this.context.lineJoin = 'round';
    this.pointer = event.pointerId;
    this.canvas.setPointerCapture(event.pointerId);
    this.status.textContent = t('recording');
  }

  private move(event: PointerEvent): void {
    if (event.pointerId !== this.pointer) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left, y = event.clientY - rect.top;
    this.recognizer.move(x, y);
    this.context.beginPath(); this.context.moveTo(this.x, this.y); this.context.lineTo(x, y); this.context.stroke();
    this.x = x; this.y = y;
    this.result.textContent = arrows(this.recognizer.pattern);
  }

  private finish(event: PointerEvent): void {
    if (event.pointerId !== this.pointer) return;
    this.move(event);
    this.pointer = null;
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    const pattern = this.recognizer.pattern;
    const conflict = this.recording?.conflict(pattern);
    const error = this.recognizer.overflow ? t('gestureTooLong') : !pattern ? t('drawDirection') : conflict ? t('gestureAlreadyUsed', [conflict]) : '';
    this.completed = !error;
    this.use.disabled = !this.completed;
    this.status.textContent = error;
    this.status.classList.toggle('error', !!error);
  }
}
