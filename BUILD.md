# Building SkiFree

How to build and test the browser reconstruction, and how it was derived from the original executable. For how to play, see the [README](README.md). For the recovered addresses, tables and rules, see the [reverse-engineering notes](docs/reverse-engineering.md).

## Build

Build the standalone HTML file:

```sh
python3 tools/package.py
```

Open `dist/SkiFree.html` directly in a modern browser. That single file contains all JavaScript, styles and sprites, works offline, and is the only file needed to play or share.

The build produces only `dist/SkiFree.html`. Generated output and test screenshots live under `dist/`.

On every push to `main`, `.github/workflows/pages.yml` runs the Node tests, builds the file and deploys it to GitHub Pages as `index.html`.

## Project layout

```text
index.html, style.css       Minimal page and original-style HUD/dialogs
assets/, assets.js          Original sprites, metadata and browser declarations
original-data.js            Tables recovered from executable bytes
original-controls.js        Input, courses, time/distance units and scoring flow
original-world.js           Terrain, NPCs, chairlift and boundary yetis
original-collision.js       Sprite bounds and actor-specific collision rules
engine.js                   Fixed-step simulation and subsystem integration
game.js                     Browser input, rendering, storage and automatic scaling
docs/reverse-engineering.md Recovered addresses, tables and rules per subsystem
tests/                      Simulation/control checks and browser smoke tests
tests/fixtures/             Original movement instructions and expected outputs
tools/                      Packaging, bitmap extraction and reference interpreter
dist/                       Generated releases/screenshots; ignored by Git
```

`assets/manifest.json` is the sprite metadata source. Packaging and extraction regenerate `assets.js` from it. The game needs no npm dependencies; packaging needs only Python's standard library.

## Tests and tools

Run the dependency-free Node tests (22 tests, including 682 movement reference cases):

```sh
node --test tests/engine.test.mjs tests/original-controls.test.mjs
```

Run the browser checks with Playwright, which covers desktop, mobile emulation, high-resolution viewports, input mapping, high scores, offline loading and resizing, and writes screenshots to `dist/screenshots/`:

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
python3 tools/package.py
node tests/browser-test.mjs
```

To use an existing Chromium or Chrome instead, set `SKIFREE_BROWSER_EXECUTABLE` to its path.

The remaining tools need the original executable (see below). Regenerate the movement fixtures:

```sh
python3 tools/movement-oracle.py /path/to/ski32.exe
```

Regenerate the sprites (requires Pillow); add `--contact-sheet dist/sprites.png` for a preview sheet:

```sh
python3 tools/extract-assets.py /path/to/ski32.exe
python3 tools/package.py
```

Both tools verify the executable's SHA-256 before reading it.

## How it was reverse engineered

The source is `ski32.exe` (118,784 bytes) from the [SkiFree 1.04 download](https://ski.ihoc.net/ski32.zip) on [Chris Pirih’s official SkiFree website](https://ski.ihoc.net/), SHA-256:

```text
3572d3757638bc1ae388c3d007ba59ba1f370911901e2a35d2f1297e8cf0ff35
```

The analysis was static, using [REA](https://github.com/morluto/rea) 6.8.0 with Hopper, LLVM `objdump`, and Python/Pillow for byte inspection and resource decoding.

1. **Inventory.** Verified format, architecture and digest, and enumerated the PE resources: 89 bitmaps plus icon and string resources.
2. **Graphics.** Rebuilt a BMP header around each bitmap's DIB payload, decoded it to PNG with the white background made transparent, and kept the original resource IDs, dimensions and colors. `tools/bitmap-resources.json` records offsets and payload hashes.
3. **Behavior.** Traced initialization, the Win32 message/timer loop, keyboard and mouse handlers, actor updates, collisions and course crossings across 110 procedures, reading the assembly and jump tables directly where the decompiler output was incomplete.
4. **Tables.** Decoded the state-to-sprite map, turn transitions, movement records and landing states from file bytes into `original-data.js` and `original-world.js`. Source modules cite native addresses and REA Evidence IDs.
5. **Browser port.** Replaced Win32 drawing and input with Canvas and browser events, keeping the recovered rules: 40 ms ticks, signed 16-bit coordinates, integration before acceleration, discrete headings, original course geometry, sprite-rectangle collisions and directional yeti pursuit. High scores moved from `entpack.ini` to localStorage; touch gestures, Space as a jump alias, automatic zoom and HTML score dialogs were added for the browser.
6. **Verification.** `tools/movement-oracle.py` interprets the original movement routine's x86 instructions (bytes checked against the executable) for 682 state/velocity inputs; the JavaScript movement matches all of them. The browser build was exercised with keyboard, mouse, touch, high scores, resizing and offline loading.
