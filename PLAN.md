# Tomatoshi — Project Plan

A web-based virtual friend: **Tomatoshi**, a little tomato who lives in your
browser, reacts to your touch, and plays with the things around it. The world
it lives in can change — we start in a **living room**.

---

## 1. Vision

- Open a web page (phone or desktop) and Tomatoshi is there, doing its own thing.
- Touch it and it reacts: giggles when tapped, purrs when stroked, squeaks when
  picked up and dragged.
- It notices objects around it and uses them: naps on the couch, chases a ball,
  dances when the radio is on, gets sleepy when the lights go off.
- You can interact with the objects too, and Tomatoshi responds to what you do.
- Environments are swappable: living room first, then kitchen, garden, bedroom…

**Design pillars**
1. **Touch-first** — every interaction works with a finger; mouse is the fallback.
2. **Alive when idle** — it should feel like it has a life even if you do nothing.
3. **Data-driven world** — new rooms and objects are added as data, not new code.
4. **Small and fast** — loads instantly, runs smoothly on a mid-range phone.

---

## 2. Core concepts

| Concept | What it is |
|---|---|
| **Friend** | Tomatoshi: body, face, mood, needs, and a behavior brain. |
| **Environment** | A scene: background layers, a walkable floor area, ambient state (light, time of day), and a set of objects. |
| **Object (prop)** | Something in the scene with *affordances* — what the friend or user can do with it (`sit`, `play`, `toggle`, `eat`…). |
| **Interaction** | A user gesture (tap, stroke, drag, long-press, flick) on the friend or an object. |
| **Need** | A slowly changing value (energy, fun, hunger, affection) that drives what the friend wants to do. |

---

## 3. The friend: Tomatoshi

### Look
- Round red body, green leafy stem on top (the stem doubles as "hair" / emotion
  indicator: perky when happy, droopy when sad/tired).
- Big simple eyes, small mouth, tiny stubby feet. Cheeks blush when petted.
- Drawn in **SVG** so parts (eyes, mouth, stem, body) can be animated
  independently and stay crisp at any size.

### Animation
- Idle "breathing" squash & stretch, blinking at random intervals, looking
  toward the user's finger/cursor.
- Walk (bouncy hop), sit, sleep (Zzz), dance, eat, roll.
- Expressions: happy, laughing, surprised, sleepy, sad, annoyed, love.

### Touch reactions (v1)
| Gesture | Reaction |
|---|---|
| Tap | Giggle + little bounce |
| Rapid taps (tickle) | Laughing fit; too many → gets annoyed |
| Stroke / rub | Blush, happy eyes, affection ↑ |
| Long press | Squish, then pops back |
| Drag | Picked up, legs dangle, surprised face; dropped with a squash |
| Flick / throw | Rolls across the floor, dizzy on landing |
| Poke the stem | Stem wiggles, slightly offended |

### Needs & mood
- `energy`, `fun`, `hunger`, `affection` (0–100), decaying over time.
- Mood is derived from needs + recent events and selects the expression set.
- State is saved to `localStorage` so Tomatoshi remembers how you treated it.

### Brain (behavior)
- A simple **utility AI** on top of a **state machine**:
  - States: `idle`, `wander`, `goTo(object)`, `useObject`, `reactToUser`, `sleep`.
  - Every few seconds, score candidate actions (from objects' affordances +
    current needs) and pick the best, with a bit of randomness.
  - User interactions interrupt and take priority.

---

## 4. Environment system

A scene is defined by data, e.g. `scenes/living-room.json`:

```json
{
  "id": "living-room",
  "background": ["wall.svg", "floor.svg"],
  "floor": { "polygon": [[0, 600], [1200, 600], [1200, 800], [0, 800]] },
  "ambient": { "light": 1.0, "timeOfDay": "auto" },
  "objects": [
    { "type": "couch", "x": 300, "y": 620 },
    { "type": "lamp",  "x": 900, "y": 600, "state": { "on": true } },
    { "type": "ball",  "x": 600, "y": 700 }
  ],
  "exits": [{ "to": "kitchen", "x": 1150, "y": 620 }]
}
```

Object types are defined once (sprite, hitbox, affordances, behavior hooks) and
reused across scenes. Changing environment = loading a different scene file
with a transition (Tomatoshi walks through a door).

### Living room — v1 objects
| Object | User can… | Tomatoshi will… | Need affected |
|---|---|---|---|
| Couch | — | Sit, nap | energy ↑ |
| Lamp | Tap to toggle | Get sleepy in the dark, wake when on | energy |
| Ball | Drag / throw | Chase it, push it back | fun ↑ |
| Snack bowl | Tap to refill | Eat | hunger ↓ |
| Radio | Tap to play/stop | Dance | fun ↑ |
| TV | Tap to toggle | Sit and stare, react to colors | fun ↑ (slow) |
| Window | — | Look outside; shows real day/night | — |
| Potted plant | Tap to water | Visits its "cousin", waves at it | affection |

---

## 5. Tech stack

- **Vite + TypeScript** — fast dev server, simple static build, deployable
  anywhere (GitHub Pages / Netlify / Vercel).
- **SVG + DOM** for rendering (v1). Easy hit-testing, CSS/JS animation per body
  part, crisp on all screens. Revisit Canvas/PixiJS only if performance requires.
- **Pointer Events API** for unified touch/mouse/pen input, with a small
  gesture recognizer (tap, multi-tap, stroke, long-press, drag, flick).
- **Web Audio** for small sound effects (giggles, squeaks, boing) — optional,
  off until the first user gesture (browser autoplay rules).
- **localStorage** for persistence. No backend in v1.
- **Vitest** for unit tests of the brain, needs and gesture recognizer.
- Later: PWA manifest so it can be "installed" on a phone home screen.

### Proposed structure
```
tomatoshi/
├─ index.html
├─ src/
│  ├─ main.ts              # bootstrap, game loop
│  ├─ engine/
│  │  ├─ loop.ts           # requestAnimationFrame tick, delta time
│  │  ├─ input.ts          # pointer events → gestures
│  │  ├─ scene.ts          # load/render/switch scenes
│  │  └─ storage.ts        # save/load state
│  ├─ friend/
│  │  ├─ Tomatoshi.ts      # entity: position, state, rendering
│  │  ├─ body.svg.ts       # SVG parts
│  │  ├─ expressions.ts    # face presets
│  │  ├─ needs.ts          # needs + mood
│  │  └─ brain.ts          # utility AI / state machine
│  ├─ objects/             # couch.ts, lamp.ts, ball.ts, ...
│  └─ scenes/
│     └─ living-room.json
├─ public/assets/          # svg art, sounds
└─ tests/
```

---

## 6. Milestones

**M0 — Skeleton**
- Vite + TS project, full-screen responsive stage, game loop, deploy pipeline.

**M1 — A tomato that's alive**
- SVG Tomatoshi with idle breathing, blinking, eye tracking.
- Wander around the floor area.
- Touch: tap, tickle, stroke, drag & drop.

**M2 — The living room**
- Scene loader + living-room scene (background, floor, objects).
- Objects: couch, lamp, ball, snack bowl. User can interact with each.
- Day/night via the window, lamp-driven lighting.

**M3 — A mind of its own**
- Needs + mood, utility AI choosing objects.
- Expressions tied to mood, stem reacts to mood.
- Persist state between visits.

**M4 — Polish**
- Sounds, particles (hearts, Zzz, sweat drops), smooth transitions.
- Radio, TV, plant. PWA install.

**M5 — Changing environments**
- Door/exit system + second scene (kitchen or garden).
- Scene-specific objects; Tomatoshi remembers which room it's in.

---

## 7. Open questions

- **Art style:** flat vector / kawaii, or something more textured/painterly?
- **Personality:** cheeky, shy, sleepy? Does it speak (speech bubbles / emoji)
  or only make sounds?
- **Orientation:** portrait (phone-first) or landscape room that pans?
- **Progression:** pure toy, or light goals (unlock rooms/items by caring for it)?
- **Next environment** after the living room: kitchen, garden, bedroom, beach?
