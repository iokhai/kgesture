import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';

const index = process.argv.indexOf('--baseline');
const ref = index >= 0 ? process.argv[index + 1] : 'HEAD';
if (!ref) throw new Error('--baseline requires a Git revision');
const baseline = execFileSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], { encoding: 'utf8' }).trim();
const root = process.cwd(), output = resolve('output/overlay-benchmark');
await mkdir(output, { recursive: true });
const config = { entryPoints: ['scripts/bench-overlay.ts'], bundle: true, minify: true, format: 'iife', target: 'chrome120' };
await build({ ...config, outfile: join(output, 'before.js'), globalName: 'BeforeOverlayBench', plugins: [{
  name: 'baseline-source', setup(build) {
    build.onLoad({ filter: /[\\/]src[\\/].*\.ts$/ }, ({ path }) => {
      if (!path.startsWith(join(root, 'src') + sep)) return;
      const source = relative(root, path).split(sep).join('/');
      return { contents: execFileSync('git', ['show', `${baseline}:${source}`], { encoding: 'utf8' }), loader: 'ts', resolveDir: dirname(path) };
    });
  },
}] });
await build({ ...config, outfile: join(output, 'after.js'), globalName: 'AfterOverlayBench' });
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>KGesture overlay benchmark</title><body>
<h1>Overlay benchmark</h1><p>Baseline: ${baseline}. Current: working tree.</p>
<p>Controlled JS and Canvas submission only; excludes native event dispatch, real vsync, compositing, and total gesture latency.</p>
<button id="run">Run comparison</button><pre id="result"></pre><script src="/before.js"></script><script src="/after.js"></script><script>
document.querySelector('#run').onclick = async () => {
  const button=document.querySelector('#run');button.disabled=true;
  try {
    const results=[];
    for(const mode of ['both','hint','trail','off']) {
      for(let i=0;i<3;i++){BeforeOverlayBench.run(mode,100000);AfterOverlayBench.run(mode,100000);await new Promise(requestAnimationFrame);}
      const before=[],after=[];
      for(let i=0;i<15;i++){
        if(i%2){after.push(AfterOverlayBench.run(mode,100000));before.push(BeforeOverlayBench.run(mode,100000));}
        else{before.push(BeforeOverlayBench.run(mode,100000));after.push(AfterOverlayBench.run(mode,100000));}
        await new Promise(requestAnimationFrame);
      }
      const median=values=>values.map(v=>v.elapsedMs).sort((a,b)=>a-b)[7];
      results.push({mode,samples:100000,frameEvery:8,beforeMs:median(before),afterMs:median(after),beforeCallbacks:before[0].callbacks,afterCallbacks:after[0].callbacks});
    }
    document.querySelector('#result').textContent=JSON.stringify({baseline:'${baseline}',viewport:{width:innerWidth,height:innerHeight},userAgent:navigator.userAgent,results},null,2);
  } catch(error){document.querySelector('#result').textContent=String(error);} finally {button.disabled=false;}
};</script></body></html>`;
await writeFile(join(output, 'index.html'), html);
const port = Number(process.env.KGESTURE_BENCH_PORT ?? 4176);
createServer(async (req, res) => {
  const file = { '/': 'index.html', '/before.js': 'before.js', '/after.js': 'after.js' }[req.url];
  if (!file) { res.writeHead(404); res.end(); return; }
  try { res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : 'text/html; charset=utf-8'); res.end(await readFile(join(output, file))); }
  catch { res.writeHead(500); res.end('Unable to read benchmark output.'); }
}).listen(port, '127.0.0.1', () => console.log(`Open http://127.0.0.1:${port}/ to compare overlay work with ${baseline}. Stop with Ctrl+C.`));
