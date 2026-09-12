# 001 — The carousel that isn't a carousel

**Source:** [studioloop.com.br](https://www.studioloop.com.br/)
**Code:** [`001-diagonal-carousel/`](../001-diagonal-carousel/)

---

I sent myself a screenshot of the Studio Loop homepage with the note "look at
this carousel". A lamp, an orange velvet armchair, a little tulip table, some
books, a keyring — all laid out on a diagonal, each one tilted at its own angle,
on a deep brown ground.

Then I opened the site to find the carousel, and there wasn't one.

I scrolled the whole page. The services list, the client reel, the team, the
footer — nothing that moved on a timer. There is a lovely fan of tilted cards at
the very bottom, so I sat and watched it for six seconds. Static. I went through
the About page too. Nothing.

The carousel was the thing in my screenshot the entire time. It's the hero. It
just doesn't move on its own — it moves when you scroll, and a screenshot of a
scroll-driven track looks exactly like a static collage. Scroll a little and the
lamp slides up and off the top-left corner while a keyring arrives from the
bottom-right. Every object is on one rail.

## Reading the rail

Here is the part I care about. I could have eyeballed the angle, guessed "about
30 degrees", tweaked it until it looked close, and shipped something that felt
roughly right. Instead:

```js
[...stage.children].map((k, i) => {
  const m = new DOMMatrix(getComputedStyle(k).transform);
  return {
    i,
    x: +m.e.toFixed(0),
    y: +m.f.toFixed(0),
    rot: +(Math.atan2(m.b, m.a) * 180 / Math.PI).toFixed(1),
  };
});
```

Which gave me this:

```
0  1.webp            x=-475  y=-442  rot=-75.0   461x461
1  4.webp            x=-190  y=-247  rot=-60.0   399x499
2  luminaria-on.png  x=  96  y= -52  rot=-45.0   532x532
3  chair.webp        x= 381  y= 144  rot=-30.0   502x457
4  6.webp            x= 666  y= 339  rot=-15.0   391x560
5  5.webp            x= 951  y= 534  rot=  0.0   343x456
6  1.webp            x=1236  y= 729  rot= 15.0   461x461
7  2.webp            x=1521  y= 924  rot= 30.0   478x478
...
```

Every single row is `+285` in x, `+195` in y, and `+15°` of rotation from the one
before it. That's it. That's the whole interaction, and it's two numbers.

`(285, 195)` puts the rail at 34.4° below horizontal, with 345px between slots.
The rotation isn't decoration applied per object — it's a function of position.
An object is upright at exactly one point on the rail and leans further the
further it gets from it. Position and rotation are one motion, which is why it
looks like the objects are *tumbling along* the diagonal rather than sliding
down it.

There are 13 items and they recycle. When one reaches the top-left end it
reappears at the bottom-right, off-screen, and comes round again.

## The thing I couldn't have guessed

Row 2: `luminaria-on.png`.

**On.** I ran a HEAD request for `luminaria-off.png` on the same path and got a
200. The lamp has two states, sitting right there in their asset folder.

I never actually caught it switching on the live site. But the filenames tell you
what the people who built it were thinking about, and once you've seen
`-on`/`-off` you can't un-see the idea: as an object passes through the upright
position, if it's a thing that can be switched on, switch it on.

So that's in my version. The lamp, a phone and a little CRT flicker to life as
they arrive at centre, and gutter out as they leave.

## What I changed

One thing, deliberately. On Studio Loop the upright object sits at `(951, 534)`
in a 1920×1080 stage — noticeably down and right of centre. That's a nice
composition for a hero with a logo top-left and text either side, but for a
reusable component "the upright one is in the middle" is the more obvious
contract. So slot 0 is dead centre in mine.

The rest is theirs: 285, 195, fifteen degrees.

## Making it run two ways

I wanted auto-advance *and* scroll-to-go-faster, and the naive version of that is
two pieces of code that fight each other over who owns the position.

The fix is that neither of them owns it. There's one number — `progress`, the
track position in slots — and one spring that chases a target every frame.
Auto-advance adds 1 to the target every 2.2 seconds. Scrolling adds a fraction of
a slot per wheel tick. Both just nudge the same target.

Which means scrolling isn't a separate mode. It's the same carousel, run faster.
Anything hooked to a slot crossing — the flicker, the caption — fires identically
whether the timer moved it or your thumb did. And on release the target snaps to a
whole number, so it always comes to rest with something upright.

Wheel and touch deltas get projected onto the rail's axis first, so only movement
*along* the diagonal counts. Scrolling perpendicular to it does nothing, which is
the correct and slightly surprising behaviour.

## Proving it, instead of squinting at it

Screenshots can't tell you whether a rotation is 15° or 14°, and they certainly
can't show you a 200ms flicker. So I drove it from the console.

Six wheel ticks, then measure the delta:

```
movedX: -570.1   movedY: -390.1   rot: -15° → -45°   ratio: 0.684
```

`570 = 2 × 285`. `390 = 2 × 195`. `0.684 = 195/285`. Exactly two slots, dead on
the axis, snapped to a whole slot, rotation moved by exactly 30°.

And sampling the lit layer's opacity every frame for nine seconds:

```
   0ms  on      6650ms  on
  50ms  off     6700ms  off
 141ms  on      6742ms  on
 174ms  off     6775ms  off
 250ms  on      6851ms  on
```

Catches, drops out twice, holds. A filament striking, not a crossfade — which
matters, because a fade reads as a dissolve and a hard cut reads as a switch
being thrown.

## Assets

Twelve objects, generated rather than lifted — the whole point is that you can
ship this, and Studio Loop's renders are Studio Loop's. Generated on a flat white
field, cut out locally with `rembg`, trimmed to their alpha bounding box.

The one real gotcha: for the three on/off pairs, generate the **lit** version
first, then edit only the light out of it using the lit render as a reference.
That locks the geometry. Then crop both frames to the *union* of their bounding
boxes — crop them independently and the object shifts a few pixels between
states, and your flicker becomes a twitch.

## Take it

```bash
cd 001-diagonal-carousel && npm install && npm run dev
```

`src/carousel/` is self-contained. Bring your own objects.

And go look at [the original](https://www.studioloop.com.br/) — the rebuild is a
mechanism, theirs is a whole piece of design.

---

## The Instagram cut

**Hook (first 2s):** "This isn't a carousel. Watch what happens when I scroll."

**Caption:**

> I screenshotted this homepage and told myself "build this carousel".
>
> Then I opened the site and there was no carousel. Scrolled the whole page
> twice. Nothing moves on a timer.
>
> The carousel was in my screenshot the whole time — it's the hero, and it only
> moves when you scroll. A still frame of a scroll-driven track just looks like
> a collage.
>
> So instead of guessing the angle, I read it off the page. Every object is
> exactly 285px right, 195px down, and 15° further rotated than the one before
> it. That's the entire interaction. Two numbers.
>
> The rotation isn't decoration — it's a function of position. An object is
> upright at exactly one point and leans further the further it gets. That's why
> they look like they're tumbling along the line instead of sliding down it.
>
> Then I found `luminaria-on.png` in their assets. On. There's an off. So in
> mine, anything that can be switched on flickers on as it passes through
> centre.
>
> Full code in the repo — link in bio. Original by @studioloop, go look at it,
> it's better than my rebuild.
>
> #webdesign #frontend #react #creativecoding #uidesign

**Slides:**

1. The screenshot. "Build this carousel."
2. Scrolling the whole site. "There is no carousel."
3. Back to the hero, scrolling — the objects move. "Oh."
4. The console dump, the deltas highlighted: `+285, +195, +15°`
5. Diagram of the rail — upright at centre, leaning either side
6. `luminaria-on.png` → HEAD `luminaria-off.png` → `200`
7. The rebuild running, lamp flickering on at centre
8. The measurement receipts: `-570.1, -390.1, -30°`
9. Repo + "what should I pull apart next?"
