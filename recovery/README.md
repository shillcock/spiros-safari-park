# Spiro’s Safari Park — recovered code and behavior

## Result

The main game module was successfully decompiled from `CD_ROM/spiro.exe`.
We do **not** need to recreate a runnable Python version before making the
HTML/JavaScript version. The recovered logic plus the original PNG/WAV assets
are a strong reference for a faithful browser remake.

- `spiro.py`: recovered Python 2.3 game module (original filename `spiro.pyw`).
- `spiro.py.dis`: bytecode disassembly, for checking decompiler interpretations.
- `boot_common.py` and `.dis`: py2exe startup plumbing, not gameplay.
- `recover.py`: repeatable static extraction/decompilation; does not run the game.

This is decompiler output, not the original source. Names, constants, and much
of the structure survive; original comments/formatting do not. It contains
Python 2 syntax and redundant/unreachable `return` statements (including a
module-level trailing return), and is not a ready-to-run modern Python port.
Decompilation completed without an error; actual runtime behavior has not been
tested, and the output has not been exhaustively checked against disassembly.

## Reproduce

From the project root, with `uv` installed:

```sh
uv venv --python 3.11 /tmp/spiro-recovery-venv
uv pip install --python /tmp/spiro-recovery-venv/bin/python -r recovery/requirements.txt
/tmp/spiro-recovery-venv/bin/python recovery/recover.py
```

The executable has a `PYTHONSCRIPT` PE resource containing a py2exe header,
`library.zip` name, and a marshaled list of two Python 2.3 code objects.
`xdis` reads these old objects without executing them; `uncompyle6` decompiles
them. `library.zip` itself contains supporting library bytecode, not the game.

Original executable SHA-256:
`a8b088ea5350e8af34f4779b28ec859eaf958b4f1f0b4e107b44416d77aab4f7`

The `CD_ROM` files were not modified.

## Original game rules

### Screen and controls

- Logical resolution: **800 × 600**, fullscreen.
- Field background: RGB **(52, 106, 16)**. The photo's brighter green is not
  the literal color specified by the code.
- Animal roaming bounds: `(0, 0, 800, 480)`.
- Player bounds: `(0, 0, 800, 490)`; the player can overlap the cage area by
  10 pixels. The full sprite rectangle is clamped inside these bounds.
- Arrow keys only. One direction per frame, priority up, down, left, right;
  no diagonal movement. Escape exits gameplay.
- Target **30 frames/second**. Player speed **5 pixels/frame** (~150 px/s).
- Player starts horizontally centered at the top of the field, using
  `guide.png` (64 × 144). Horizontal movement flips the sprite.
- Collisions use axis-aligned sprite rectangles, not visible-pixel masks.

### Opening and escape

1. Show `welcome.png`, loop `house_lo.wav` at 75% volume, wait for any key.
2. On entering gameplay, reduce music to 25% and play `intro.wav` (13 seconds).
3. All six animals begin locked in their respective cages. They still run
   their movement logic, clamped inside the cage, rather than sitting still.
4. After **16,000 ms**, unlock all six and play `escaped.wav` (~6.45 seconds).
5. Pickup and delivery are disabled until **23,000 ms** after gameplay starts.
   Thus the animals get roughly seven seconds to scatter while the escape
   announcement plays. The player can move throughout the introduction.

The timing comparisons are strictly `>` rather than `>=`.

### Animal movement

One animal of each kind: **beaver, elephant, monkey, penguin, snake, zebra**.

- Each gets a random speed of **4–9 pixels/frame** (~120–270 px/s), fixed for
  that animal for the game.
- Initial direction is randomly 0–4, including stationary; initial movement
  counter is 5–25 frames.
- Each movement frame decrements the counter. If it remains positive, the
  animal moves in its current cardinal direction. Otherwise it chooses a
  direction 1–4 and resets the counter to 15–35 frames (no move that frame).
- Movement is clamped at bounds, not bounced. An animal may push against an
  edge until its next random direction change.
- Horizontal movement flips its image. Monkey and penguin have reversed
  left/right image assignments relative to the other animals.
- Caged animals use their cage rectangle as movement bounds. Upon escape,
  their bounds become the field; the next movement clamps them into it.

### Catching and carrying

- After the 23-second gate, touching a free animal automatically picks it up.
- Only one animal can be carried. No action button, dropping, or throwing.
- On pickup, its species sound plays, followed immediately by a `gotcha.wav`
  play call. These are separate mixer effects, so they may overlap, not a
  sequential queue.
- Carried animal stops wandering and follows at:
  - animal center X = player center X + 10
  - animal bottom = player center Y − 10
- This produces the appearance of carrying it above/on the player's back.
- Animal movement happens before collision handling, so a newly picked-up
  animal adopts its carried position on the next frame.

### Cages and delivery

- Bottom row starts at **y = 480**, height **120**.
- Left-to-right order: beaver, elephant, monkey, penguin, snake, zebra.
- Python 2 integer division makes each slot **133 pixels** wide, with left
  edges 0, 133, 266, 399, 532, 665. The row leaves two pixels at the right.
- `cage.png` uses pure green `(0, 255, 0)` as a transparency color key.
  A browser remake must reproduce this transparency; the image is RGB,
  not an RGBA sprite with its own alpha channel.
- Cage labels are centered, white Arial Black, size 24, on black rectangles
  133 × 30 at the cage centers. Labels are a separate sprite layer.
- Touching the matching empty cage automatically delivers the animal. The
  animal resumes wandering within the cage, and the player is free to catch
  another.
- Touching a wrong empty cage keeps the animal on the player's back.
- `good_job.wav` and `wrong_cage.wav` only play when **no sound-effect channel
  is busy**. Background music uses a separate channel and does not suppress
  them. A delivery still succeeds even when its praise sound is suppressed.
- Wrong-cage sound can repeat if the player stays there after audio ends;
  there is no explicit cooldown other than the mixer-busy check.
- Returned animals stay locked: there is only **one escape event**.

Initial placement quirk: animals start at the origin; initial `lockup` changes
their bounds but does not explicitly place them in cage centers. Their normal
movement/clamping subsequently brings them inside. This need not be preserved.

### Winning

- After the initial escape, count correctly occupied cages every frame.
- All six returned means immediate victory. No timer, lives, losing state,
  visible score display, or increasing difficulty appears in the code.
- Display `way_to_go.png`, play `youre_a_ranger.wav` (~11.55 seconds), then
  `ending.wav` (~26.47 seconds), waiting for effects to finish at each step.
- Fade music over one second, wait 1.1 seconds, then exit. No replay menu.

## Asset roles

All originals are in `CD_ROM/data/`:

| Assets | Role |
| --- | --- |
| `welcome.png`, `way_to_go.png` | Opening and victory screens, 800 × 600 |
| `guide.png` | Player cut-out |
| Species `.png` files | Six hand-drawn animal sprites, with alpha |
| `cage.png` | Shared cage artwork; green color-key transparency |
| `art.png` | Scanned drawing sheet; not loaded by the game code |
| `ariblk.ttf` | Arial Black for labels; check redistribution rights before publishing |
| `house_lo.wav` | Looping background music (~7.10 s) |
| `intro.wav`, `escaped.wav` | Opening instructions and escape announcement |
| Species `.wav` files | Animal pickup sounds |
| `gotcha.wav`, `good_job.wav`, `wrong_cage.wav` | Pickup/delivery feedback |
| `youre_a_ranger.wav`, `ending.wav` | Sequential victory effects |

Audio roles above come from filenames and play calls, not transcription or
listening to the recordings. The background music's provenance/rights have
not been established either.

## Suggested browser remake

Use one HTML canvas with the original 800 × 600 coordinate system, scaled to
fit the viewport while preserving its aspect ratio. Keep the assets unchanged;
process the cage's color key on load. Start audio on the user's keypress/click
for browser autoplay compatibility. A fixed 30 Hz simulation preserves the
old speeds and random movement cadence across different display refresh rates.

Use explicit title → introduction → escape/grace period → catching → victory
states, while permitting player movement throughout gameplay. Preserve the
original timings initially, then adjust if desired. Add replay and optional
modern controls as improvements, not inferred original features.

No need for Python runtime/SDL emulation, and no need to reproduce old busy
waiting, exit handling bugs, or decompiler artifacts. Keep game rules separate
from rendering so a future 3D presentation can reuse the same rules/assets.
