# 🍅 Tomatoshi

A touch-friendly web companion: a small, grumpy tomato living in your phone's
browser that reacts to your touch and (reluctantly) plays with the objects
around it. First home: a living room. Next: the kitchen.

See [PLAN.md](./PLAN.md) for the design, decisions and milestones.

## Playing with it

| Do this | It does this |
|---|---|
| Tap it | Glares at you, `!` or `…` |
| Tap it fast, again and again | Tries not to laugh… then loses it `#@%!` and storms off |
| Rub it | Looks away, blushes, a `♥` slips out and is quickly covered up |
| Press and hold | Gets squished `💢`, pops back when you let go |
| Poke the stem | Stem wobbles `💢` |
| Drag it | Picked up, legs kicking; drop it anywhere on the floor |
| Fling it | Flies, bounces, rolls, gets dizzy, then furious |
| Leave it alone | Wanders, mutters, glares at you; sulks if ignored too long |

And the room:

| Do this | It does this |
|---|---|
| Tap the snack bowl | Refills it; Tomatoshi rushes over and eats (grudgingly). Empty bowl? It glares at you |
| Tap or fling the ball | Tomatoshi chases it and kicks it back. Hit it with the ball and it kicks back harder |
| Tap the lamp | Light on/off. In the dark it goes to nap on the couch; light wakes it up, annoyed |
| Tap the window | Opens/closes the curtains. The sky follows the real time of day |
| Tap the couch | Bounces the cushions, and whoever is sitting on them |

Add `?hour=22` to the URL to see the room at a different time of day.

## Development

```sh
npm install
npm run dev        # dev server; open the printed URL (use --host to try it on your phone)
npm test           # unit tests
npm run build      # typecheck + production build into dist/
```
