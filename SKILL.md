---
name: website-to-code
description: Reverse-engineer an interaction from a live website and rebuild it as a self-contained React component, then publish it as an episode of the "turning cool websites into code you can use" series. Use when the user points at a site or a screenshot and wants the effect rebuilt — "how does this work", "can you build this carousel/scroll effect/hover thing", "make this in React", "new episode", "add this to the series". Covers finding the real mechanism in the DOM rather than eyeballing it, proving the rebuild matches, and writing the episode up.
---

# Turning cool websites into code you can use

Rebuild one interaction from a real site, correctly, and ship it as an episode.

The whole value of this series is that the numbers are **real**. Anyone can
approximate a diagonal carousel. The reason to watch is that the spacing is the
site's actual spacing and the rotation is its actual rotation, because they were
read off the live page. Never eyeball a value you could measure.

## 1. Find the actual interaction

The user will usually send a URL and a screenshot. **The screenshot is a hint,
not the target.** A still frame of a scroll-driven effect looks like a static
collage; a still of a carousel looks like a layout.

- Open the page in Chrome and scroll the whole thing in a few large batched
  steps, screenshotting as you go. Batch scroll+wait+screenshot in one
  `browser_batch` call — one round trip per three or four viewports.
- Check the other pages in the nav before concluding the effect isn't there.
- To tell "animating" from "static", screenshot the same region two or three
  times a couple of seconds apart and compare. Identical frames mean it is
  static or scroll-driven, not on a timer.

Confirm you have the right thing before spending anything on assets. In episode
001 the "carousel" turned out to be the hero, which reads as a static collage in
a screenshot and only reveals itself as a track when you scroll.

## 2. Read the numbers off the DOM

This is the step that makes the series worth doing. Do not skip to building.

Find the element, walk up its ancestors to find the stage, then dump every item
in stage coordinates. `DOMMatrix` turns a computed transform into numbers you
can actually read:

```js
// Walk up from a known child to find the positioned stage.
let n = img, out = [];
for (let i = 0; i < 8 && n; i++, n = n.parentElement) {
  const cs = getComputedStyle(n), r = n.getBoundingClientRect();
  out.push({ i, tag: n.tagName, cls: n.className, t: cs.transform,
             pos: cs.position, w: Math.round(r.width), x: Math.round(r.x) });
}
```

```js
// Then dump every item on the stage, decomposed.
[...stage.children].map((k, i) => {
  const m = new DOMMatrix(getComputedStyle(k).transform);
  return {
    i,
    x: +m.e.toFixed(1),
    y: +m.f.toFixed(1),
    rot: +(Math.atan2(m.b, m.a) * 180 / Math.PI).toFixed(2),
    scale: +Math.hypot(m.a, m.b).toFixed(3),
    z: getComputedStyle(k).zIndex,
  };
});
```

Now look for the constant. Take differences between consecutive rows. In 001 the
x/y deltas were `(285, 195)` for every single pair and the rotation delta was
exactly `15°` — which is the entire interaction, in two numbers.

### When there is no DOM

If the page renders to a `<canvas>`, none of the above exists — the geometry
lives in a closure as numbers. Walking the React fiber for the scene usually
fails, and the Three.js devtools hook has to be installed before the bundle
runs, which is too late by the time you can execute anything.

Instrument the draw calls instead. Every frame the page has to tell the GPU
where everything is:

```js
const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
const orig = gl.drawElements.bind(gl);
gl.drawElements = function (...args) {
  const program = gl.getParameter(gl.CURRENT_PROGRAM);
  const loc = gl.getUniformLocation(program, 'modelViewMatrix');
  if (loc) rows.push(Array.from(gl.getUniform(program, loc)));
  return orig(...args);
};
// ...one frame later, restore gl.drawElements
```

- **Enumerate the uniforms first** (`getProgramParameter(p, gl.ACTIVE_UNIFORMS)`
  then `getActiveUniform`). Asking for `modelMatrix` and getting nothing means
  the material does not have one, not that the site uses instancing —
  `MeshBasicMaterial` only gets `modelViewMatrix` and `projectionMatrix`.
- **Also wrap `drawArrays` and the `*Instanced` variants**, and count which
  ones actually fire.
- Decompose each matrix: elements 12-14 are the position, the lengths of the
  first three columns are the scale, and the normalised columns are the
  rotation. **A rotation basis of exact identity in camera space means the
  thing billboards** — it always faces the viewer and never turns, which often
  means you can rebuild it in CSS with no WebGL at all.
- Deduplicate, then **cluster by proximity**: objects are frequently drawn more
  than once, as coplanar quads a few thousandths apart.

Things worth checking while you are in there:

- **Scroll to 0 and wait before sampling.** Mid-animation values are noise; the
  settled values are usually round numbers and the round numbers are the design.
- **z-index across the set.** A monotonic run means the stack order is derived
  from position, which is a rule you need to reproduce.
- **The asset filenames.** They leak intent. `luminaria-on.png` sitting next to
  `luminaria-off.png` told me the lamp had two states before I had seen it
  switch.

## 3. Reduce it to one driving value

Before writing a component, find the single number that everything else is a
function of. In 001 it is `progress`, the track position in slots: position,
rotation, z-index, opacity and which item is "current" are all derived from it.

This is what makes the modes compose instead of fighting. Auto-advance and
scrolling should both move the *same* value — a target that one spring chases —
so "scroll to go faster" is the same behaviour at a different rate, not a second
code path. Anything you attach to slot crossings then fires identically in both.

Put the measured constants in one file with the measurement recorded in a
comment, so the next person knows they are not arbitrary.

## 4. Assets

Only if the effect needs them. Prefer generating over lifting: never ship the
original site's artwork.

Via the Higgsfield MCP (see the memory note `reference_higgsfield_3d_typography`
for current plan gating):

- Isolated objects: one object, flat pure white seamless background, soft studio
  lighting, "no text, no logos, no people, no other props" in every prompt.
- **Cut out locally with `rembg`**, not through the API — `isnet-general-use`
  with alpha matting matches the hosted remover and costs nothing.
- Trim each cutout to its alpha bounding box, so the artwork's visual centre is
  the element's centre and layout maths stays honest.
- **Two states of one object must be geometry-locked:** generate the lit version,
  then image-to-image off its `job_id` with "keep everything identical, change
  ONE thing". Then crop both to the **union** of their bounding boxes — crop them
  separately and the object shifts a few px and the transition jitters.

QA the actual pixels before building anything around them. Generated assets sneak
in brand text and logos regardless of the prompt; build a contact sheet and look
at it.

## 5. Build it

- Self-contained folder under `src/<name>/`, React and nothing else. Someone
  should be able to copy that one directory out.
- Geometry in its own module, pure functions, no React.
- The engine in a hook that owns one rAF loop and exposes plain values.
- Frame-rate independent easing: `1 - Math.pow(1 - ease, dt / (1000/60))`, never
  a fixed per-frame lerp.
- Design the effect in a fixed design space (e.g. 1920×1080) and scale it to
  *cover* the viewport. Cover is what guarantees off-screen recycling actually
  happens off screen at every aspect ratio.
- Honour `prefers-reduced-motion` for anything that moves on its own.

Do the demo page after the component works, not before.

### Two Chrome behaviours that will cost you an hour each

Both present identically: elements correctly positioned and sized, box-shadows
painting, and **nothing inside them**. Every diagnostic says the images are
fine (`complete: true`, a real `naturalWidth`, HTTP 200).

- **Chrome defers decoding images whose transform changes every frame**, and
  under continuous animation it defers forever. `await img.decode()` on every
  image before the loop starts.
- **`transform-style: preserve-3d` does not scale.** It is the obvious way to
  get depth sorting for free, but it puts every element into one 3D rendering
  context and past a couple of dozen layers Chrome stops rastering most of
  them. If the things billboard, there is no orientation to preserve: keep the
  stage flat, put the perspective on the direct parent, and sort by z into
  `zIndex` yourself.

Adding `will-change` to "help" makes both of them worse.

The test that separates these from everything else: **force a solid background
colour onto the elements.** If they light up, they are painting and it is the
content specifically that is not.

## 6. Prove it matches

Measure, do not eyeball. Screenshots cannot tell you whether a rotation is 15° or
14°, and they definitely cannot show you a 200 ms flicker.

Drive the component from the console and assert on the result:

```js
// Dispatch real events, then check the delta is exactly N slots.
for (let i = 0; i < 6; i++) {
  surface.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 16));
}
```

```js
// Sample a fast visual state every frame and log only the changes.
const t0 = performance.now(), log = []; let prev = null;
(function tick() {
  const sig = [...document.querySelectorAll(SEL)].map(e => getComputedStyle(e).opacity).join(',');
  if (sig !== prev) { log.push(`${Math.round(performance.now() - t0)}ms ${sig}`); prev = sig; }
  if (performance.now() - t0 < 9000) requestAnimationFrame(tick);
})();
```

In 001 this confirmed six wheel ticks moved an item exactly `-570, -390` px and
`-30°` — two slots, dead on-axis, snapped — and that the flicker ran
on/off/on/off/on across 205 ms. Those numbers go in the write-up; they are the
proof the rebuild is a rebuild and not an impression.

Then check it at phone width. Resize the window rather than trusting the CSS.

## 7. Ship the episode

```
00N-slug/
├── README.md          usage, the props contract, how it works
├── src/<name>/        the component
├── src/App.tsx        demo page
└── public/            generated assets
```

- Add a row to the repo `README.md` episode table.
- Write `blog/00N-slug.md`: what caught your eye, what you assumed, what the DOM
  actually said, the numbers, what you changed and why, and what you got wrong on
  the way. The wrong turns are the good part.
- Credit the source site prominently, and link it.
- End the post with the Instagram cut — hook, caption, slide outline — so the
  post and the episode never drift apart.

## Tone

Show the working. The interesting content is "I thought it was X, the DOM said
Y". Do not present a clean result as though it arrived clean, and do not claim a
number you did not measure.
