# Performance measurements

## Feedback optimization in 0.1.9

The overlay now schedules hint-only updates when the confirmed pattern or action changes, builds hint text only when needed, and exits immediately when feedback is disabled. Direction glyph lookup and replacement objects are reused. Stroke drawing remains frame-batched and bounded; fullscreen canvases are released after each gesture.

Compared with `de72bb1` (0.1.8) in Headless Chrome 153, macOS arm64, at 1440 × 1050 CSS pixels:

| Feedback mode | Before median | After median | Before callbacks | After callbacks |
| --- | ---: | ---: | ---: | ---: |
| Trail and hint | 4.6 ms | 3.1 ms | 12,500 | 12,500 |
| Hint only | 1.3 ms | 0.5 ms | 12,500 | 1 |
| Trail only | 4.2 ms | 2.9 ms | 12,500 | 12,500 |
| Neither | 0.3 ms | 0.3 ms | 0 | 0 |

Each trial sends 100,000 points to the overlay with a steady confirmed `U` action and flushes queued feedback once per eight points. There are three warm-up rounds and 15 measured rounds per implementation, with alternating order. Trials yield to the browser between rounds. Timing is subject to browser clock precision and machine load.

This measures synchronous overlay JavaScript and Canvas submission. It excludes the recognizer, native input dispatch, real vsync, rasterization/compositing, extension startup, and total gesture latency. A 33% reduction in this component benchmark does not mean that the whole extension or perceived response is 33% faster. Changing patterns still update their hints.

Reproduce with the same baseline source and current working tree:

```sh
pnpm bench:overlay --baseline de72bb1
```

Open the printed localhost URL and run the comparison. Both bundles use the same harness; baseline source is read from Git. Stop the server with Ctrl+C. Set `KGESTURE_BENCH_PORT` if the default port is occupied.

## Recognizer

The existing warmed Node.js benchmark measured roughly 1.8–2.3 ns per sample for straight motion, jitter, and corners on this machine. The recognizer was not changed for this optimization. Those numbers describe a tight JavaScript loop, not browser input latency.

```sh
pnpm bench
```

Both benchmarks use existing development tools and Node.js built-ins. They add no runtime packages to the extension.
