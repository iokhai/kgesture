# KGesture

A lightweight mouse gesture extension for Chromium-based browsers.

## Features

- Record custom gestures and assign 18 navigation, tab, and scrolling actions.
- Customize trails, action hints, recognition distance, and excluded sites.
- Import and export local settings as JSON, with no telemetry or cloud service.
- English and Simplified Chinese localization, selected by the browser UI language.
- Bounded gesture state, frame-batched drawing, and no mousemove listener while idle.

## Installation

Requirements: Node.js 22+, pnpm, and a Chromium-based browser with Chrome 120+ support.

Clone the repository and build the extension:

```sh
git clone https://github.com/iokhai/kgesture.git
cd kgesture
pnpm install
pnpm build
```

Open `chrome://extensions/`. Enable **Developer mode**, click **Load unpacked**, and select the `dist` directory. Refresh existing web pages after installation.

After rebuilding, reload KGesture in the extension manager and refresh web pages to use the updated scripts.

## Quick Start

1. Open a regular web page.
2. Hold the right mouse button, draw downward (↓), and release to open a new tab.
3. Click the extension icon to open settings. Choose **Record gesture**, draw a gesture, confirm it, select an action, and click **Save**.

Click an existing gesture to record a replacement. Use Shift + right-click for the native context menu; on macOS and Linux, two stationary right-clicks within 500 ms also open it.

Gestures are unavailable on browser internal pages, extension stores, and other pages that prohibit content scripts. Unsupported UI languages fall back to English.

## Contributing

Keep changes focused and run the checks before submitting:

```sh
pnpm check     # Type checking, behavioral tests, and production build
pnpm i18n:check # Validate every language catalog and message reference
pnpm bench     # Pure recognizer benchmark
pnpm dev       # Watch TypeScript; rebuild after changing public assets
pnpm run pack  # Create release/kgesture-<version>.zip
```

- Preserve stable action IDs and configuration compatibility.
- Keep mouse event handling synchronous and memory bounded.
- Add meaningful tests for recognition, browser actions, and configuration changes.
- i18n uses Chromium's native API with zero third-party runtime packages. Catalogs stay outside the JavaScript bundles, and English message keys provide the TypeScript contract.

To add a language, copy `public/_locales/en/messages.json` to `public/_locales/<Chromium-locale>/messages.json` (for example, `de`). Translate the `message` values and update `localeTag` to the corresponding language tag (for example, `de` or `zh-CN`). Preserve message keys and placeholder names and positions. Run `pnpm i18n:check` and `pnpm check`. The browser discovers the new catalog automatically; no business code or language registry needs updating.

Benchmark results measure the recognizer alone, excluding event dispatch, rendering, messaging, and service worker startup. They are not end-to-end latency measurements.

## License

[MIT](LICENSE). Copyright © 2026 KGesture contributors.
