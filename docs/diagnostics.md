# Gesture diagnostics

Diagnostics are disabled by default. They record no URLs or page content and make no network requests. The opt-in log stays in the page's session storage and holds at most 16 gestures. Recorded fields include extension version, confirmed pattern/action, cancellation reason, input counts, button state, action result, and viewport positions immediately and 100 ms after scrolling.

Enable in the affected page's developer console before reproducing a gesture:

```js
sessionStorage.setItem('kgesture:diagnostics', '1');
```

Read after a failure:

```js
JSON.parse(sessionStorage.getItem('kgesture:diagnosticLog') || '[]');
```

Interpret `outcome`:

- `pending`: a gesture started but no completion or cancellation was recorded yet.
- `cancelled`: `reason` identifies the event or setting that cancelled tracking.
- `unbound`: the final confirmed pattern had no bound action.
- `executed`: the action ran; `moved` reports whether a scroll target changed.
- `failed`: the action threw or the background worker rejected it; inspect `error`.

A changed `afterY` followed by a restored `settledY` points to scrolling being changed again after execution. `frame` distinguishes a top page from a child frame. Each frame logs in its own origin's session storage, so a cross-origin frame must be enabled and inspected in its own console context.

Disable and clear persisted output:

```js
sessionStorage.removeItem('kgesture:diagnostics');
sessionStorage.removeItem('kgesture:diagnosticLog');
```

Logs are diagnostic evidence. They do not establish that an unrecorded failure has the same cause as a controlled reproduction.
