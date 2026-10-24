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
| Tap the radio | Music. If nobody's looking, Tomatoshi dances. Touch it mid-dance and it was definitely not dancing |
| Tap the TV | Changes channel: color bars (it watches), static (it grumbles), a cooking show with a knife (it flees) |
| Tap the plant | Waters its tomato cousins, the only ones it's nice to. Let them go thirsty and it glares at you |

### The kitchen

Tap the door (top right of the living room) to look into the kitchen.
Tomatoshi stays where it is, but it wanders between rooms by itself, comes to
find you if you're gone a while (it would never admit it), and sometimes peeks
back in after leaving. Tap the kitchen door to go back.

| Do this | It does this |
|---|---|
| Tap the fridge | Opens it: cold air (it hates that) and snacks (it loves those). Hungry and the fridge is shut? It glares at you |
| Tap the sink | Runs the water. It takes baths in the sink: annoyed at first, then `♪` |
| Tap the stove | Lights the burners. Far too hot to go near |
| Tap the knife block | Rattles the knives. Why would you do that |
| Tap the vegetable crate | The onion stings: anyone nearby starts crying |
| Tap the ceiling light | Light on/off |

It won't go near the knives or the salad bowl (it has tomato slices in it).

### Its needs

Tomatoshi has four needs that slowly drop: **energy**, **fun**, **fullness**
and **affection**. They decide what it does (a hungry tomato heads for the
bowl, a bored one goes for the ball, a tired one naps) and how it looks: its
stem stands up when it's content, droops when it's tired or lonely, and
bristles when it's angry. Stroking and attention raise affection; squishing,
flinging and waking it up lower it.

It remembers everything between visits. While you're away it rests, and
gets a bit hungry and bored. When you come back after a while it lets you
know how it feels about you.

### URL options

| Option | What it does |
|---|---|
| `?hour=22` | See the room at a different time of day |
| `?debug` | Show its needs, mood and what it's doing |
| `?reset` | Forget everything and start fresh |

Where only a `#word` can be added to the link, `#debug`, `#reset` and `#night`
(same as `?hour=22`) work too.

## Install it on your phone

Open the deployed page in your phone's browser and use **Add to Home Screen**
(Safari: Share → Add to Home Screen; Chrome: menu → Install app). It then
opens full screen like an app, and works offline.

## Development

```sh
npm install
npm run dev        # dev server; open the printed URL (use --host to try it on your phone)
npm test           # unit tests
npm run build      # typecheck + production build into dist/
```
