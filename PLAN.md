# Tomatoshi — Project Plan

A web-based virtual friend: **Tomatoshi**, a small, grumpy tomato who lives in
your phone's browser, reacts to your touch, and (reluctantly) plays with the
things around it. The world it lives in can change — we start in a
**living room**, then move to the **kitchen**.

---

## 1. Decisions

| Topic | Decision |
|---|---|
| Art style | Flat and cute: solid shapes, no outlines or thin outlines, soft palette, no textures. |
| Personality | **Grumpy.** Complains about everything, secretly enjoys attention. |
| Speech | Speech bubbles with **symbols only** (no words): `!`, `?`, `#@%!`, `♥`, `♪`, `Zzz`, `💢`, `…`. |
| Screen | **Phone portrait** (9:16 stage), letterboxed on wider screens. |
| Game type | **Pure toy** for now, built so it can become a **puzzle game** later (see §6). |
| Environments | Living room → **kitchen** → (later) more. |
| Autonomy | **Alive in the space**: it roams, picks what to do and (from M5) moves between rooms on its own. |
| Sound | **None for now.** Everything is readable visually; sound may come later. |

---

## 2. Vision

- Open the page on a phone and Tomatoshi is there, doing its own thing and
  looking mildly annoyed about it.
- Touch it and it reacts: grumbles when tapped, fumes when tickled too much,
  pretends not to like being stroked (but blushes).
- It notices objects around it and uses them: naps on the couch, kicks the
  ball back at you, secretly dances to the radio and stops when you look.
- You can interact with the objects too, and Tomatoshi responds to what you do.
- Rooms are swappable: living room first, then the kitchen.

**Design pillars**
1. **Touch-first** — every interaction works with a finger; mouse is the fallback.
2. **Alive when idle** — it should feel like it has a life even if you do nothing.
3. **Data-driven world** — new rooms and objects are added as data, not new code.
4. **Puzzle-ready** — world state is explicit, so goals and puzzles can be layered on later.
5. **Small and fast** — loads instantly, runs smoothly on a mid-range phone.

---

## 3. Core concepts

| Concept | What it is |
|---|---|
| **Friend** | Tomatoshi: body, face, mood, needs, and a behavior brain. |
| **Environment** | A scene: background layers, a walkable floor area, ambient state (light, time of day), and a set of objects. |
| **Object (prop)** | Something in the scene with its own *state* and *affordances* — what the friend or user can do with it (`sit`, `play`, `toggle`, `eat`…). |
| **Interaction** | A user gesture (tap, stroke, drag, long-press, flick) on the friend or an object. |
| **Need** | A slowly changing value (energy, fun, hunger, affection) that drives what the friend wants to do. |
| **Event** | Something that happened (`lamp.toggled`, `friend.ate`, `friend.tickled`). Everything goes through one event bus. |

---

## 4. The friend: Tomatoshi

### Look
- Round red body, green leafy stem on top. The stem is the mood indicator:
  stiff and spiky when grumpy, perky when (secretly) happy, droopy when tired.
- Default face: half-lidded eyes and a small frown. Eyebrows do most of the acting.
- Cheeks blush pink when petted — the one thing it can't hide.
- Drawn in **SVG** so each part animates independently and stays crisp.

### Personality: grumpy
- Default mood is "unimpressed". Happiness shows only in small tells: blush,
  stem perks up, a tiny `♥` that it quickly "pops".
- Reacts badly to being bothered, but gets sulky if ignored for too long.
- Enjoys things in secret: dances to the radio, stops and glares when you tap it.

### Speech bubbles
- Small bubble above its head, with one or two **symbols**, never words.
- Symbols are drawn as SVG icons (not emoji fonts) so they look the same on
  every phone and match the flat style.
- Starter set: `!` surprise · `?` confused · `#@%!` cursing · `💢` angry ·
  `♥` affection · `♪` music · `Zzz` sleep · `…` unimpressed · `🍴` hungry.

### Touch reactions (v1)
| Gesture | Reaction | Bubble |
|---|---|---|
| Tap | Glares at you, small hop | `!` or `…` |
| Rapid taps (tickle) | Tries not to laugh, then explodes in anger | `#@%!` |
| Stroke / rub | Looks away, but blushes; affection ↑ | `…` then tiny `♥` |
| Long press | Squished, very offended | `💢` |
| Drag | Picked up, legs kick, outraged face; squash on drop | `!` |
| Flick / throw | Rolls across the floor, dizzy, then furious | `@` |
| Poke the stem | Stem wiggles, protects its head | `💢` |

### Needs & mood
- `energy`, `fun`, `hunger`, `affection` (0–100), decaying over time.
- Mood (grumpy, very grumpy, sulky, secretly happy, sleepy) is derived from
  needs + recent events and selects the face, stem pose and bubble set.
- State is saved to `localStorage` so Tomatoshi remembers how you treated it.

### Brain (behavior)
- A simple **utility AI** on top of a **state machine**:
  - States: `idle`, `wander`, `goTo(object)`, `useObject`, `reactToUser`, `sleep`.
  - Every few seconds, score candidate actions (from objects' affordances +
    current needs) and pick the best, with a bit of randomness.
  - User interactions interrupt and take priority.

---

## 5. Environment system

The stage is a fixed **720 × 1280** coordinate space (9:16), scaled to fit the
phone screen. A scene is a data file, e.g. `scenes/living-room.json`:

```json
{
  "id": "living-room",
  "background": ["wall", "floor"],
  "floor": { "polygon": [[0, 820], [720, 820], [720, 1280], [0, 1280]] },
  "ambient": { "light": 1.0, "timeOfDay": "auto" },
  "objects": [
    { "id": "couch", "type": "couch", "x": 200, "y": 860 },
    { "id": "lamp",  "type": "lamp",  "x": 600, "y": 840, "state": { "on": true } },
    { "id": "ball",  "type": "ball",  "x": 400, "y": 1100 }
  ],
  "exits": [{ "to": "kitchen", "x": 680, "y": 820 }],
  "triggers": []
}
```

Object types are defined once (art, hitbox, state, affordances, behavior hooks)
and reused across scenes. Changing environment = loading a different scene
file with a transition (Tomatoshi stomps through a door).

### Living room — v1 objects
| Object | User can… | Tomatoshi will… | Need affected |
|---|---|---|---|
| Couch | — | Sit, nap | energy ↑ |
| Lamp | Tap to toggle | Get sleepy in the dark; annoyed when woken by light | energy |
| Ball | Drag / throw | Kick it back at you, harder if annoyed | fun ↑ |
| Snack bowl | Tap to refill | Eat, grudgingly | hunger ↓ |
| Radio | Tap to play/stop | Dance in secret; stop and glare when tapped | fun ↑ |
| TV | Tap to toggle | Sit and stare; grumble at the channel | fun ↑ (slow) |
| Window | — | Look outside; shows real day/night | — |
| Potted plant | Tap to water | Visits its "cousin", the only one it's nice to | affection |

### Kitchen — next environment (ideas)
Being a tomato in a kitchen is dangerous, which suits a grumpy character.
| Object | Idea |
|---|---|
| Knife block | Tomatoshi is terrified; refuses to walk past it (`!`, `💢`). |
| Salad bowl | Deeply offended by it. |
| Fridge | Open it, cold air, Tomatoshi shivers. Contains snacks (and maybe puzzle items later). |
| Stove | Too hot; sweat drops. |
| Sink | Splash it; gets annoyed, then enjoys the bath. |
| Other vegetables | Neighbors to grumble at (cucumber, onion that makes it cry). |

---

## 6. Ready for puzzles later

We build a toy now, but avoid choices that would block a puzzle game:

- **Explicit world state.** Every object's state (lamp on/off, fridge open,
  ball position) lives in one serializable store, not hidden in animations.
  Puzzles become "reach this state".
- **Event bus.** All actions emit events. A future puzzle system just listens
  for them (`"lamp off" AND "friend on couch" → solved`).
- **Triggers in scene data.** Scene files already have an (empty) `triggers`
  list: `{ when: <conditions>, then: <actions> }`. v1 ignores it; later it drives
  puzzles, unlocks and little scripted moments.
- **Object capabilities as data.** Objects can later become carryable,
  combinable or lockable without code changes (e.g. `"carryable": true`).
- **Room exits with conditions.** Exits can later require a condition
  (`"requires": "fridge.open"`), turning room switching into progression.
- **Deterministic logic.** Brain and needs use an injectable clock and random
  source, so puzzle states can be tested and reproduced.

---

## 7. Tech stack

- **Vite + TypeScript** — fast dev server, static build, deployable anywhere.
- **SVG + DOM** for rendering. Easy hit-testing, per-part animation, crisp on
  all screens. Revisit Canvas/PixiJS only if performance requires.
- **Pointer Events API** for unified touch/mouse/pen input, with a small
  gesture recognizer (tap, multi-tap, stroke, long-press, drag, flick).
- **No sound** for now. If added later: Web Audio, enabled after the first
  user gesture (browser autoplay rules).
- **localStorage** for persistence. No backend.
- **Vitest** for unit tests of the brain, needs, events and gesture recognizer.
- Later: PWA manifest so it can be installed on a phone home screen.

### Structure
```
tomatoshi/
├─ index.html
├─ src/
│  ├─ main.ts              # bootstrap
│  ├─ engine/
│  │  ├─ loop.ts           # requestAnimationFrame tick, delta time
│  │  ├─ stage.ts          # 9:16 SVG stage, scaling, layers
│  │  ├─ events.ts         # event bus
│  │  ├─ input.ts          # pointer events → gestures
│  │  ├─ scene.ts          # load/render/switch scenes
│  │  └─ storage.ts        # save/load state
│  ├─ friend/
│  │  ├─ Tomatoshi.ts      # entity: position, state, rendering
│  │  ├─ art.ts            # SVG body parts
│  │  ├─ expressions.ts    # face presets
│  │  ├─ bubbles.ts        # speech bubble + symbol icons
│  │  ├─ needs.ts          # needs + mood
│  │  └─ brain.ts          # utility AI / state machine
│  ├─ objects/             # couch.ts, lamp.ts, ball.ts, ...
│  └─ scenes/
│     ├─ living-room.ts
│     └─ kitchen.ts
├─ public/                 # sounds, icons
└─ tests/
```

---

## 8. Milestones

**M0 — Skeleton** ✅
- Vite + TS project, 9:16 portrait stage, game loop, event bus, CI.
- Placeholder living room and a static Tomatoshi.

**M1 — A tomato that's alive (and grumpy)** ✅
- Idle breathing, blinking, eyes following your finger.
- Wander around the floor.
- Touch: tap, tickle, stroke, long press, stem poke, drag & drop, flick,
  with grumpy reactions.
- Speech bubbles with symbol icons.
- Simple autonomous life: idle, look around, wander, mutter, glare, sulk when ignored.

**M2 — The living room**
- Scene loader + living-room scene from data.
- Objects: couch, lamp, ball, snack bowl. User can interact with each.
- Day/night via the window, lamp-driven lighting.
- World state store (puzzle-ready).

**M3 — A mind of its own**
- Needs + mood, utility AI choosing objects.
- Expressions and stem tied to mood.
- Persist state between visits.

**M4 — Polish**
- Particles (hearts, steam from anger, Zzz, sweat drops), transitions.
- Radio, TV, plant. PWA install.

**M5 — The kitchen**
- Door/exit system + kitchen scene; Tomatoshi wanders between rooms by itself.
- Kitchen objects (knife block, fridge, sink, stove, salad bowl).
- Tomatoshi remembers which room it's in.

**Later — Puzzle mode**
- Activate scene triggers, goals and conditional exits.
- Carryable/combinable items.

---

## 9. Open questions

- When Tomatoshi is in another room, does the view follow it, or do you stay
  and see it leave (and maybe peek back in)?
