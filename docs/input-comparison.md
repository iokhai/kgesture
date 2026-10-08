# Input comparison with simpleGestures

The scroll fixes in 0.1.3 and 0.1.4 did not establish that the reported intermittent failure was resolved. A correctly displayed action is not proof that the release handler executed it.

## Source comparison

Compared [handler.ts](https://github.com/RyutaKojima/simpleGestures/blob/master/src/js/app/content/handler.ts), [InputGesture.ts](https://github.com/RyutaKojima/simpleGestures/blob/master/src/js/app/domains/Entities/InputGesture.ts), and [content_scripts.ts](https://github.com/RyutaKojima/simpleGestures/blob/master/src/js/app/content/content_scripts.ts).

| Stage | simpleGestures | KGesture before 0.1.5 | KGesture 0.1.5 |
| --- | --- | --- | --- |
| Right button down | `mousedown` for that button | `pointerdown`, which only fires for the first pressed mouse button | `mousedown` |
| Movement | Confirm direction and action from move events | Confirm direction and action from move events, including coalesced samples | Preserve coalesced movement samples; exclude pointer events that only report button changes |
| Right button release | `mouseup`; execute the previously confirmed action | `pointerup`; sample release coordinates again before resolving the action | `mouseup`; execute the previously confirmed command without adding a release sample |
| Multiple buttons | Release of the right button can execute the action even if another button stays down | Release can be missed or cancelled before the final button is released | Handle each button independently, including the preceding button-change `pointermove` |
| Scroll action | Scroll viewport and start-target ancestors | Since 0.1.4, scroll viewport and composed ancestors | Preserve 0.1.4 behavior, including Shadow DOM and reverse-column lists |

The implementations still differ in recognition thresholds, diagonal handling, drawing, and cancellation. This is a comparison of the relevant input stages, not a claim of complete behavioral equivalence.

## Observed failures and verification

Using browser-native CDP mouse input on a local scrolling page, the same upward movement followed by release-only horizontal drift had these results:

- KGesture 0.1.4: release offsets of 0 and 5 CSS pixels scrolled to the top; an offset of 15 pixels left the page at `scrollY = 600` despite the upward action hint.
- The installed simpleGestures in Brave scrolled from 600 to within 3 pixels of the top for all those offsets. This page uses CSS smooth scrolling.
- Chorded left/right input also left KGesture 0.1.4 at 600, whereas the installed original scrolled toward the top when the right button was released.

KGesture was tested in Google Chrome for Testing with its unpacked extension. The original was tested in the user's Brave profile on the same local fixture using the same input sequences. These are controlled reproductions; they do not capture the user's original failing gesture or prove that every reported failure had this cause.

`tests/content.test.ts` checks the real content entry point's event handlers, including release drift, button changes before `mouseup`, confirmed turns, stationary clicks, cancellation, and trusted input. Browser checks also verify final scroll position rather than merely the presence of an action hint.

With 0.1.5, release offsets of 0, 5, and 15 pixels all finished at `scrollY = 0`. Both left-first and right-first chord sequences also finished at zero on right-button release. The automated suite passed; separate browser checks covered scrolling containers and the gesture recorder. These observations support the fixes for the reproduced conditions, not a guarantee about an unrecorded real-world failure.

## 0.1.8 release sequencing

The original ignores a move whose button mask no longer includes the right button; KGesture was cancelling the confirmed command immediately. A controlled browser sequence reproduced an upward hint followed by no scroll when that move preceded `mouseup`. KGesture now ignores the move and lets the release handler finish the command.

The same sequence now finishes at the top. During manual verification in Brave, opt-in diagnostics recorded 0.1.8 executing top/bottom actions and retaining the resulting viewport position after 100 ms. The user reported that the problem no longer occurred during that verification. The temporary recording was disabled and cleared afterward. No raw input logs are included in the repository.

See [Gesture diagnostics](diagnostics.md) for optional local tracing if a different failure occurs.
