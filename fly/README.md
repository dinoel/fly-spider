# The fly

House flies that sit on the screen glass of any page, a swatter to hit them with and a rag to wipe up after. One
file, no dependencies.

```html
<script src="fly.js"></script>
```

`demo.html` shows it on light, dark and coloured backgrounds.

## What it does

- A fly spends much of its time creeping a few steps at a time. It also grooms, walks in short bouts, turns sharply
  and rests now and then. It keeps away from the pointer: it walks off when the pointer stays near and flies off when
  the pointer rushes at it or clicks close by. It never leaves the screen on its own. With several flies, each keeps
  a little apart from the others.
- Two tools, each with its own button: the swatter and the rag. A click on a button takes that tool up and puts the
  other down. Esc, a right click or the button again put it down. While a tool is out, clicks and drags go to the
  tool instead of the page. Over the buttons the tool is put by and the pointer shows.
- The swatter: click to hit. A hit fly lies on its back, then slides down off the screen and leaves a smear. Every
  further hit sprays, drains its goo and sticks it to the glass for a few seconds. One slap can hit two flies. Five
  seconds after a dead fly has gone, a new one comes in from beyond an edge. A slap close by may send the other flies
  off, and they stay jumpy for a while.
- A smear stays until it is wiped off. It is wet at first and dries about 45 seconds after its fly has gone, losing
  its shine.
- The rag: press and rub. Each stroke takes off part of what is under it, in streaks, so a smear goes in a few
  passes. Every turn of the hand starts a new pass. A wet smear comes off in two or three passes, and the first ones
  drag the goo along in streaks. A dried one needs twice the rubbing. A dead fly under the rag is wiped up with it.
  The cloth gets dirtier the more it cleans. A live fly keeps further away from the rag than from a bare pointer.
- It is heard as well as seen. The wings buzz at a house fly's 180 to 215 beats a second, with the pitch jittering
  from beat to beat; each fly has a voice of its own. The buzz grows louder and brighter as a fly comes up off the
  glass, and moves from ear to ear with it. A newcomer is heard for a moment before it comes into view. Walking is
  silent, as it is in life. The swatter swishes as it comes down, then slaps: a crack, a thump from the screen, the
  handle rattling as it springs back, and a squelch if a fly was under it. The rag hisses on the glass, duller
  through wet goo, and squeaks now and then once the glass is clean. It is all synthesised with Web Audio, so there
  are no files to load. Browsers allow sound only after the first click or key press on the page, so it stays silent
  until then.
- F hides the flies and their smears, except while typing in a field.
- With `prefers-reduced-motion` it does not appear at all.

## Settings

The small button beside the tools opens a panel with three settings:

- **Schwierigkeit** (difficulty): how hard the flies are to swat. The table shows how often a calm fly gets away
  from a swatter brought down right on it.

  | | sitting | walking | grooming |
  |---|---|---|---|
  | Leicht | 0% | 5% | 0% |
  | Mittel | 21% | 46% | 12% |
  | Schwer | 46% | 75% | 29% |

  After a slap close by, a fly is 1.4 times as likely to see the next one coming. The difficulty also sets how
  nervously a fly takes a swatter swung at it, how often a slap close by sends it off, and on Schwer how often it
  hops about.
- **Fliegen**: how many flies, 1 to 8. New ones are heard coming, then fly in one after another from beyond an edge.
  Those no longer wanted fly off; a dead one just is not replaced.
- **Ton**: sound on or off.

A press anywhere else or Esc closes the panel. The settings are kept for the site in `localStorage`.

## Options

On the script tag:

| Attribute | Effect |
|---|---|
| `data-button="left"` | the buttons bottom left (default) |
| `data-button="right"` | bottom right |
| `data-button="none"` | no buttons of its own |
| `data-flies="3"` | how many flies there are until the user chooses otherwise (default 1) |
| `data-level="easy"`, `"normal"`, `"hard"` | the difficulty until the user chooses otherwise (default normal) |
| `data-sound="off"` | silent until the user turns the sound on |

Any element with `data-fly-swatter` works as the swatter button, and any with `data-fly-rag` as the rag button. Their
`aria-pressed` follows the tool. When the page has such an element at load time, the script adds no buttons and no
settings panel.

In script, `window.flyWatermark` has:

- `set({ flies, level, sound })` changes any of the settings, and `settings` reads them;
- `count` is how many flies there are now, counting any on their way out;
- `take('swatter'|'rag'|null)` takes up a tool or puts it down, and `arm(true|false)` does the same for the swatter
  alone;
- `hide(true|false)` hides or shows the flies;
- `sound(true|false)` turns the sound on or off.

## How it stays out of the way

Everything lives in a shadow root on `<html>`, so page styles do not reach the flies and their ids cannot clash with
the page's. The layer sits above the page and never takes a click, except the buttons and the settings panel. The
only thing it adds to the page itself is a rule for while a tool is out: it hides the mouse pointer and stops a
finger from scrolling the page.
