import { performance } from 'node:perf_hooks';
import { writeFileSync, mkdirSync } from 'node:fs';
import { Recognizer } from '../src/core/recognizer';

const samples = 1_000_000, rounds = 15;
const r = new Recognizer();
type Case = 'straight' | 'jitter' | 'corners';
function run(kind: Case): number {
  r.start(0, 0, 12);
  const start = performance.now();
  if (kind === 'straight') {
    for (let i = 0; i < samples; i++) r.move(i, i % 3);
  } else if (kind === 'jitter') {
    for (let i = 0; i < samples; i++) r.move(i % 5, i % 7);
  } else {
    for (let i = 0; i < samples; i++) {
      const step = i % 400;
      if (step === 0) r.start(0, 0, 12);
      if (step < 100) r.move(step * 2, 0);
      else if (step < 200) r.move(198, (step - 100) * 2);
      else if (step < 300) r.move(198 - (step - 200) * 2, 198);
      else r.move(0, 198 - (step - 300) * 2);
    }
  }
  const elapsed = performance.now() - start;
  const expected = kind === 'straight' ? 'R' : kind === 'jitter' ? '' : 'RDLU';
  if (r.pattern !== expected) throw new Error('Benchmark failed to recognize the gesture');
  return elapsed;
}
const cases = (['straight', 'jitter', 'corners'] as Case[]).map(kind => {
  for (let i = 0; i < 5; i++) run(kind);
  const times = Array.from({ length: rounds }, () => run(kind)).sort((a, b) => a - b);
  const median = times[Math.floor(rounds / 2)]!;
  return { kind, medianMs: median, medianNsPerSample: median * 1_000_000 / samples,
    millionSamplesPerSecond: samples / median / 1000, minMs: times[0], maxMs: times.at(-1) };
});
const report = {
  measuredAt: new Date().toISOString(), node: process.version, platform: `${process.platform}/${process.arch}`,
  scope: 'Warm pure recognizer; excludes browser event dispatch, drawing, storage, IPC and service worker startup. Not an end-to-end latency claim.',
  samplesPerRound: samples, rounds, cases,
};
mkdirSync('output', { recursive: true }); writeFileSync('output/benchmark.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
