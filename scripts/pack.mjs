import { mkdir, readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
await mkdir('release', { recursive: true });
const { version } = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
const filename = `kgesture-${version}.zip`;
await rm(`release/${filename}`, { force: true });
execFileSync('zip', ['-q', '-r', `../release/${filename}`, '.', '-x', 'build-metrics.json'], { cwd: 'dist' });
console.log(`release/${filename}`);
