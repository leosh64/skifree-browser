# Reverse-engineering notes

Recovered behavior of SkiFree 1.04 (`ski32.exe`), by subsystem, with native addresses and REA Evidence IDs. For the source binary, method and tools, see [BUILD.md](../BUILD.md). Where Hopper procedures include switch tables or tail targets as code, values were decoded from the assembly and byte tables instead.

## Data tables

`original-data.js` holds these tables, decoded from the executable's bytes:

| Address | Data |
| --- | --- |
| `0x40a1ac` | 64 state-to-bitmap mappings, signed 16-bit entries |
| `0x40a22c` | Initial states for actor types 0–10 |
| `0x40a258` | 22 left/right state-transition pairs |
| `0x40a308` | 22 movement records, 16 bytes each: vertical acceleration/max, horizontal acceleration/ratio/direction, state ID |
| `0x40a468` | Landing-state transitions for states 13..21 |
| `0x402b88` | Per-tick style-scoring dispatch (Free Style only) |

`original-world.js` holds five other-skier motion rows from `0x40a490` and eight snowboarder rows from `0x40a4e0`, each six signed shorts plus an int32 state: `[yAccel,yMax,xAccel,xRatio,xDirection,pad,state]`.

## Movement

### Tick and arithmetic

Reset at `0x404970` sets a 40 ms timer; `0x404a80` creates the player at `(0,0,0)` in state **3**, stopped and facing sideways. The browser starts in that state.

`0x402be0` adds velocity to position, then changes acceleration. Fast mode doubles each position increment; acceleration and velocity limits stay the same. Positive height decrements vertical velocity by one; otherwise height and vertical velocity are set to zero. Coordinates and velocities wrap as signed 16-bit values, in the browser too.

`0x403430` moves horizontal speed toward `trunc(ratio * max(vy,0) / 2)`, using the table direction or the current velocity's sign. Overspeed loses two units per tick; otherwise the table acceleration applies. Vertical velocity approaches the table maximum the same way.

The player update at `0x402990` integrates position, then applies the motion table. Ground crash state 11 holds position while both velocity components drain by one per tick, then changes to state 12. Stepping states 7/9 return to 3; 8/10 return to 6. Airborne transitions and landing poses use the original tables. Style can go negative and is awarded only while Free Style is active.

MSVC `rand` at `0x406cda` computes `state = state * 214013 + 2531011` modulo 2^32, returning `(state >> 16) & 32767`; `0x4020b0` takes the remainder. The browser uses the same generator, seeded from the clock on restart as the native `GetTickCount` seed is.

### Arithmetic reference

`tools/movement-oracle.py` parses the instructions at `0x403430..0x403532` from `objdump`, checks every instruction's bytes against the executable, and interprets that integer instruction subset for 682 state/velocity inputs. Results are in `tests/fixtures/movement.json` (instruction excerpt in `tests/fixtures/movement.asm`); the JavaScript movement function matches every case.

## Controls, courses, HUD and timer

The control switch mappings were decoded from the byte/target tables at `0x4063bc/0x4063a8`, `0x40644c/0x406424`, and the per-state tables.

### Initial state, clock and view

- `0x404a80` creates type 0, state **3**, at **x=0,y=0,z=0**. The timer starts immediately; state 3 is stationary.
- `0x404970` sets timer interval `0x40c678` to **40 ms**; `0x404ad0` passes it to `SetTimer` ID `0x29a`. `0x401000` records elapsed milliseconds from `GetTickCount` in `0x40c5f4` and advances actors once per callback. Displacement is per tick; the HUD divides by actual callback time and refreshes when the last update is older than **327 ms** (`0x147`).
- `0x405fa0` anchors the player at **width/2, height/3**. `0x4014b0` draws sprites centered horizontally and bottom-aligned: `screenX = worldX + anchorX - cameraX - trunc(bitmapWidth/2)`; `screenY = worldY + anchorY - cameraY - z - bitmapHeight`.
- `0x406890` places the status window at the **top right**, sized to its labels/values plus four pixels. `0x406970` frames it with the stock black brush; `0x406a70` selects **ANSI_VAR_FONT** (stock font ID 10).

REA evidence: reset `ev_06f8bcf7d9b74aa0ec0bae1654148ee16c0ac84f77bef0b8b354da6cae5218b7`; start `ev_e344aa713e6f128f6f909703704132cac659f8dd084d5f9dbb915c57487ad17b`; tick `ev_68287c88173c7bf06941ed5245658935ab2f025602cbbb02fb3fe7288831292a`; sprite rectangle `ev_c8f8376a239a7c951379c5cd759c72abb4252f02d39d8f5c7e44fa76e04fa02f`; status drawing `ev_2cdd36d0030bdd1e7481d164d4537706ca40847b0f4a22ff42e1e32fc0c92f8a`.

### Keyboard and mouse

`0x405800` dispatches WM_KEYDOWN to `0x406170`, WM_CHAR to `0x406780`, mouse motion to `0x406550`, and click/double-click to `0x4066d0`. Each keydown or OS repeat is one discrete state change.

- F2 resets; F3 toggles pause; Escape minimizes the window. Enter resets when no player actor exists.
- Left/right and numpad 4/6 use the 22-state turn table at `0x40a258`. Turning to state 7 sets `vx=max(vx-8,-8)`; turning to state 8 sets `vx=min(vx+8,8)`.
- Down/numpad 2 sets ground state 0. Up/numpad 8 steps uphill (state 9/10, `vy=-4`) from the side-facing states when `vy=0`. In the air these keys select trick states.
- Home/numpad 7 selects state 3; Page Up/numpad 9 selects 6; End/numpad 1 selects 1; Page Down/numpad 3 selects 4.
- Insert/numpad 0 jumps from the ground: `vz=2`, state 13, and `vy-=4` if `vy>4`. A mouse click jumps higher (`vz=4`, state 13) or cycles the airborne trick state. The browser adds Space as an alias for Insert.
- Lowercase `f` toggles fast mode, which doubles x/y/z displacement in `0x402be0`. Debug characters `t` (tick), `r` (redraw) and `x/X/y/Y` (position) stay out of the browser build.
- Mouse motion without a button points the skier toward the cursor relative to the anchor. `0x4065e0` computes `r=trunc(4*dy/dx)` when `dy>0`; cutoffs −12, −6, −3, −1, +1, +3, +6, +12 select states 0..6, and positions above the player select sideways states 3/6. Airborne aiming uses quadrant states 13..16 (`0x406670`). States 11 and 17 ignore steering.

REA evidence: control dispatcher `ev_fd4c977fa9337db70d72b7386f593d9b9a31901321ec158a337c523e4f0fe0f4`; mouse `ev_d15b2d9ef0235a3f584e4f6dd2ea452409827afce9a79fb99b6ec925fe3587a7`; mouse heading `ev_c26e1e812caabd929b9a40f05c93674ec668eb91be42a2abbf615d57ca1cc838`; mouse jump `ev_35ecd87b32435def40b7738deedbd4125b7354ef06c12855e08dab0f088f6c2f`; fast displacement `ev_c0a7d2c9524ef382d5a3cee7d8e0f7a717f6953798487c26e5662d17f466c810`.

### Courses and signs

All courses share one terrain. **Crossing y=640 inside a course's x interval** starts it, with the crossing x and time interpolated between the previous and current coordinates. Returning to y≤640 cancels it. Free Style entry only enables scoring (`0x40323f`); re-entry preserves the accumulated score, which is cleared on a full restart.

| Course | x interval at start | Finish y | Length | Flags |
| --- | --- | --- | --- | --- |
| Slalom / SS | −576 to −320 inclusive | 8640 | **500 m** | **24** single flags, y 960..8320 every 320, red x=−496 then blue x=−400 alternating |
| Tree Slalom / GS | 320 to 512 inclusive | 16640 | **1,000 m** | **39** single flags, y 1040..16240 every 400, red x=400 then blue x=432 alternating |
| Free Style / FS | −160 to 160 inclusive | 16640 | **1,000 m** | — |

Distance is **16 internal units per displayed meter**.

Red flags (sprite 23) are passed at **x≤flagX**, blue flags (sprite 24) at **x≥flagX**; only the next pending flag is checked each tick. A passed flag becomes green marker 25; a missed one becomes red marker 26 and adds **5,000 ms** by shifting the stored race start. Flags carry no style points. Finishing records the time or score and shows the **High Scores** box, after which skiing continues. The style accumulator increments only while Free Style is active (`0x403420`).

After each Tree Slalom flag, the construction loop consumes random8, random32 and random400 calls for a tree that the loop then overwrites; the helper makes the same calls.

Start banners (sprites 57/58) sit at each course's left/right x bound at y=640, finish banners (59/60) at the same bounds and the finish y. Direction signs 61/62/63 sit at `x=max(viewLeft+60,-320)`, `x=0` and `x=min(viewRight-60,320)`, with `y=viewBottom-60`, capped to 520 when above 640. `0x4051e0` places logo 53 at (−86,0), copyright 54 at (−86,14), and instruction signs 55 at (92,30) and 56 at (92,66).

REA evidence: course construction `ev_6a79f727215f116a71f64710f1a90880aab9f79dbb376c6bee01b90769eb25eb`; Slalom `ev_bf1073df9c87fcddb44eca5fc3b039b6bd869f4263f9c7f7baf1df9f5ede258f`; Tree Slalom `ev_7145eb98a1487733687f1454827378bf4e0702b93855341c2ec15df39f9c9262`; Free Style `ev_8e3e9c40fabf60b43d06908918d05f229af4a44c7c57558f6384d153aa78e716`.

### HUD and high scores

`0x401b80` displays distance as `trunc(signedY/16)`, or remaining distance `(finishY-y)/16` during a course. Speed is **signed vertical velocity**, `trunc(vy*1000/(16*lastTickMs))`. Race time (`0x40c944`) runs only during Slalom and Tree Slalom, starting at zero and holding the last result afterward, formatted as hours:minutes:seconds.hundredths.

`0x402ec0` loads up to 10 scores from the `Ski` section of `entpack.ini` (keys **SS**, **GS**, **FS**), inserts the new value best-first, saves, and shows the **High Scores** message. Race times are negated so shorter times rank higher; style points stay positive. The resource strings `" <-- that's you!"` and `" <-- try again!"` mark the result.

REA evidence: HUD `ev_1bc241816edc9d335b4b7c7de92fe8d362072e5e0f31e6aeea7d582e91c21e51`; high scores `ev_07b3e1941c50227c63c2b34537bbf3b2dbde9d0e14c8d481b108493c1e0ad3e8`.

### Helper interface

`original-controls.js` exports `SkiOriginalControls`: `applyKey(game,code)`, `mouseClick(game)`, `mouseState(dx,dy,airborne)`, `mouseAim(game,dx,dy)`, `initCourses(game)`, `updateCourses(game)`, `hud(game)`, and the course definitions. The engine supplies `player` with previous coordinates, `addActor(type,sprite,x,y,z)`, `setActorState(actor,state)`, `randomInt(n)`, `timeMs`, `tickMs`, `score`, `reset()`, `pause()`, and optionally `showHighScores(courseKey,value,isTime)`. `game.course` stores course state; `game.styleActive` mirrors Free Style scoring. Courses update after the player moves and before its next coordinate snapshot.

## Collision

`original-collision.js` implements the branches below. REA Evidence: `ev_8e47a6041d27c2b97648b90761acd23af52c366f50cfadd81f4cfec064e740ef` (function `0x403a00`); rectangle `ev_a8bbb227ea986eabe8d4211647ce066263b7dc622c0145276387ceebed2ea622` (function `0x401410`).

### Actor representation and broad phase

`+0x18` is type, `+0x1c` state, `+0x10` sprite ID. Signed 16-bit x/y/z/vx/vy/vz are at offsets `0x40/42/44/46/48/4a`.

`4014b0` builds a rectangle from the actual bitmap size: left = x − trunc(width/2), right = left + width; bottom = y − z, top = bottom − height. `401290` requires strict overlap on both axes; collisions are rectangle-based.

`401e50` calls collision once in each direction per broad-phase pair, unless the first call removed an actor. `403a00` skips source actor types ≥11. Old actor versions are read through `+0x04` (`404070`). Y crossing means the new and old relative Y straddle zero, including equality at either end, unless both are zero. Narrow phase uses z intervals `[z,z+spriteHeight]` and this crossing test.

### Skier against target types

The source is type 0. State 17 (airborne tumble) ignores further contacts.

| Target type | Sprite / identity | Effect |
| --- | --- | --- |
| 1, 3, 4 | skier, snowboarder, lift | General solid handler |
| 2 | dog | Halve vy on Y crossing |
| 5..8 | yeti | Handled by the reciprocal yeti handler, which consumes the player |
| 9 | burning tree | General solid handler; passing above restores dead tree sprite 50/type 13 and adds 1000 |
| 10 | walking tree | General solid handler; reciprocal handler stops vx and sets state 60 |
| 11 | mogul patch 27 | State 0 only: vz=1, state 13; halve vy if vy>4 |
| 12 | flag 23..26 | Halve vy on Y crossing |
| 13 | ordinary tree 49/50/51 | General solid handler plus branch-clipping exception |
| 14 | rock 45 / stump 46 | Ground: general solid handler. Airborne, z≤targetTop and crossing: vz=trunc(vy/2), +1, keep state. Airborne, z>targetTop and sprite 86: remove target, +100 |
| 15 | jump 47/48 | Ground z≤0: vz=4, state 13, +1. Airborne z<targetTop: vz=trunc(vy/2), +1, keep state. No Y crossing needed |
| 16 | rainbow 52 | If crossing, z<trunc(targetTop/2) and vy>0: vz=vy, state 13, +1 |
| 17 | signs / dog droppings 82 | Halve vy on Y crossing; sprite 82 also subtracts 16 on every contact |

General solid handler (`403d3e`): if z intervals overlap, a Y crossing is required. For type 13 only, a side hit more than half the larger bitmap width from center just halves vy. Grounded contact (z=0, vz=0) sets state 11; airborne contact sets state 17; both normally subtract 32. An uphill skier hitting stump 46 turns it into sprite 86 without the penalty. An airborne hit on dead tree 50 turns it into type 9/state 56 (burning sprite 83) and adds 16 instead of −32. When z intervals don't overlap (jumping over), obstacles other than burning trees add 6 per overlap callback.

Every score change goes through `403420`, which applies only while the Free Style global `0x40c954` is set. Scores are signed and may go negative.

### Reciprocal actors

- Type 1 skier in state <25: hit by the player, +20 Free Style; enters state 25 if the other actor is grounded, 26 if airborne.
- Type 2 dog in state <29: a moving contact makes it bark (state 29); player contact adds 3.
- Type 3 snowboarder: player contact adds 20. Types 0/1/3/13/14 below its height trigger state 34 (unless already 34); jump/rainbow types 15/16 below its height set vz=trunc(vy/2), state 33.
- Types 5..8 yeti: consume only the player. The player is removed; the yeti and its backing slot enter state 50 with velocities stopped and the eating animation timestamped. The helper sets `eatingSince=tickCount*40` and calls `onYetiCatch` so the world keeps animating.
- Type 10 walking tree: stops vx and enters state 60.

## World and actors

`original-world.js` implements the findings below.

### Actor layout and types

Live actor fields: type +0x18, state +0x1c, bitmap ID +0x10, x/y/z signed shorts +0x40/+0x42/+0x44, vx/vy/vz +0x46/+0x48/+0x4a. Fixed-world backing records are 36 bytes: live actor pointer +0, bitmap descriptor pointer +4, bitmap ID +8 (ushort), type +12 (int32), state +16 (int32), x/y/z +20/+22/+24, vx/vy/vz +26/+28/+30, timestamp +32.

Types: 0 player; 1 other skier; 2 dog; 3 snowboarder; 4 chairlift; 5 upper, 6 lower, 7 left, 8 right boundary yeti; 9 burning tree; 10 walking tree; 11 moguls; 12 course flag; 13 trees/lift towers; 14 rock/stump; 15 jumps; 16 rainbow; 17 static bitmap/sign/droppings. Names come from the sprite map and associated code.

### Initial fixed world (`0x404b50`)

Evidence `ev_6a79f727215f116a71f64710f1a90880aab9f79dbb376c6bee01b90769eb25eb`.

- Lift towers: bitmap 64, type 13, x=−128, y=−1024 to 23552 inclusive every 2048 (13 towers).
- Each row except the first: type 4/state 39 chair at x=−112, z=32, vy=−2. Each row except the last: type 4/state 41 chair at x=−144, z=32, vy=2 (24 chairs).
- Four yetis (types 5–8) start in state 42 at rest: type 7 at (−16060,0), type 8 at (16060,0), type 5 at (0,−2060), type 6 at (0,32060).
- Course flags and signs come from `original-controls.js` and share the same world.

`0x404a80` creates the player, calls `0x4051e0` for the logo and help signs, then `0x404b50`. The reset call at `0x404a84` overrides the type 0 default (state 6) with state 3 (bitmap 4) at x=y=z=0, so the skier starts stationary facing sideways.

Scenery appears only through the four `0x4025c0` calls inside the movement-accumulator crossings in `0x401e50`; initialization places the player, title/help signs, fixed world and timer, and the browser matches that.

### Terrain (`0x4025c0` through `0x402850`)

Evidence: `0x4025c0` `ev_8e9213cdf183fffb73c0ad313e9c6607816948a784b994c6785395f5dd52206b`; `0x4026f0` `ev_57861b71243c5daed588b9e219075f81c96d6c85d2c217d2eebd69348e2b1259`; `0x402770` `ev_13b39d0b486aa23c6d9d997135987b796995519ba44f1d7e72d57e1dfb40ca23`; `0x4027a0` `ev_ad99471da0b5d7622f6e6a0d21b66993ceba96dc5dc1ec6c74af930a6d263efa`; `0x4027e0` `ev_b5b15dbc33fa4d7bd9a4e71765329d64768a5e48eb2916882d2168f68269420e`; `0x402850` `ev_cbdff720930199664bb0ff5702c473e8d3966d047c85106aeca9d03d3af54c21`.

Scenery spawns 60 units beyond a viewport edge, one candidate per accumulated >60 units of camera motion on each axis, with the other coordinate random across the viewport. A density budget compares the total active bitmap area with `(width+240)×(height+240)` divided by a region divisor, checked before the type RNG call.

| Region | Selection | Divisor |
| --- | --- | --- |
| Normal | random1000: type 10 for 0..49, 13 for 50..499, 15 for 500..699, 11 for 700..749, 14 for 750..949, 16 for 950..969, 1 for 970..989, 2 for 990..999 | 32 |
| Slalom strip x[−576,−320], y[640,8640] | type 11 only | 64 |
| Tree Slalom strip x[320,512], y[640,16640] | random64==0: dog (type 2), otherwise tree (type 13) | 16 |
| Free Style strip x[−160,160], y[640,16640] | random100: type 10 for 0..1, 13 for 2..19, 15 for 20..49, 11 for 50..59, 14 for 60..79, 16 for 80..99 | 32 |

Bitmaps: type 11→27; type 13 random8 0→50, 1→51, else 49; type 14 random4 0→46, else 45; type 15 random3 0→48, else 47; type 16→52. Each tick also has a 1/666 chance of a snowboarder (type 3/state 31) entering at the right edge.

### NPC updates

Dispatcher `0x4028e0`, evidence `ev_89241cc016dc7a0dd1c9517afb63333602c84376765338b2604d07431dfd0227`.

- Other skier `0x403540`: states 22–24 integrate using the rows at `0x40a490`, with a 1/12 chance per tick of switching to 22+random3. States 25/26 hold still.
- Dog `0x403610`: state 27 sets vy=random3−1 → 28; 28 sets vx=4 → 27; 29 stops, then random32==0 → 27, else 30; 30 returns to 29, but random100==0 drops bitmap 82/type 17 at (x−4, y−2) and returns to 27. Every branch integrates.
- Snowboarder `0x403910`: integrates, then applies row `0x40a4e0+(state−31)×16`. States 31/32 swap with 1/10 probability; 33 returns to 32 after landing; 34–38 advance, wrapping to 32.
- Burning tree `0x403750`: cycles states 56→57→58→59→56 (sprites 83, 84, 85, 84) in place.
- Walking tree `0x4037b0`: state 60 has a 1/100 chance to set vx=random2×2−1 → 61; 61 has a 1/10 chance to stop → 60, else → 62 if vx<0 or 63 if vx≥0; 62/63 return to 61. Every branch integrates.

### Chairlift (`0x404290`)

Evidence `ev_d905dc92c3c7a62b1ab341fce6bdcf9a83c2b5568b43ea33073cbb5650d405f3`.

Fixed records integrate vx/vy/vz once per tick at `0x4041d7`, independent of fast mode (`0x40c670`). At y≤−1024 a chair becomes state 41, x=−144, vy=2; at y≥23552 it becomes state 39, x=−112, vy=−2. A visible state 39 chair has a 1/1000 chance per tick to drop a snowboarder (type 3/state 33) and become state 40.

### Yetis (`0x404350`)

Evidence `ev_147decd9617f7461e2e53e326ae944c5ab6895d6037e2b9019829bbf6be56736`.

Four boundary yetis are always present as fixed-world slots:

- Type 5 moves up at vy=−10 until y≤−2000 and follows when player.y<−2000.
- Type 6 moves down at vy=26 until y≥32000 and follows when player.y>32000.
- Type 7 moves left at vx=−16 until x≤−16000 and follows when player.x<−16000.
- Type 8 moves right at vx=16 until x≥16000 and follows when player.x>16000.
- Following computes dx, dy from the old coordinates. If |dx| exceeds the viewport width, the backing x jumps to player.x±width (likewise y/height). The original dx/dy are then clamped to vx[−16,16], vy[−10,26]; any movement sets vz=1. Fast mode leaves yeti speed unchanged.
- Animation: vy<0 alternates states 48/49 (sprites 74/75); vx<0 alternates 44/45 (70/71); otherwise 46/47 (72/73). Standing state 42 (68) has a 1/10 chance of state 43 (69) with vz=4; the pose holds until landing.
- On catching the player, collision `0x403af4` removes the player and sets the yeti to state 50 with velocities zeroed and a timestamp. States 50/51 alternate until 500 ms, then 52; after 700 ms 53; after 1,000 ms 54; 54/55 alternate until 3,000 ms, then 42. The world keeps updating meanwhile.

## Browser adaptations

- Each actor is one object combining the native backing slot and live instance.
- Generated scenery is removed 240 units outside the viewport.
- Fixed actors stay in memory off-screen; lift snowboarder emission is limited to an expanded viewport.
- The viewport is responsive, with the player anchored at the center and one third down.
