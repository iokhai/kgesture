interface Point { clientX: number; clientY: number }
interface SampleEvent extends Point { getCoalescedEvents?: () => Point[] }

// Recover hardware samples in order without retaining a history or copying the batch.
export function processPointerSamples(event: SampleEvent, consume: (x: number, y: number) => void): void {
  const samples = event.getCoalescedEvents?.();
  if (samples) {
    for (let i = 0; i < samples.length; i++) {
      const point = samples[i]!;
      consume(point.clientX, point.clientY);
    }
    const last = samples[samples.length - 1];
    if (last?.clientX === event.clientX && last.clientY === event.clientY) return;
  }
  consume(event.clientX, event.clientY);
}
