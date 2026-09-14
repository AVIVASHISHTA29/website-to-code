# 002 — Reading geometry out of a WebGL canvas

**Sources:** [gionatannese.com](https://www.gionatannese.com/) (sphere) and [k95.it](https://k95.it/en) (helix)
**Code:** [`002-image-sphere/`](../002-image-sphere/)

---

Episode 001 was easy in one specific way: the whole interaction was sitting in
the DOM. I dumped the transforms, took the differences between rows, and there
was the answer in two numbers.

This one starts with `document.querySelectorAll('img')` returning **zero**.

Both references are Three.js. One `<canvas>`, one WebGL context, and every
image is a textured quad that exists only as numbers inside a closure. There is
nothing to inspect. `window.__THREE__` tells you the version — r184 and r183 —
and nothing else.

## Three ways in, two of them dead ends

**React fiber.** Both sites are React (one Next, one Nuxt). I walked up the
fiber tree from the canvas's parent, scanning every hook's `memoizedState` for
anything with `isScene` or `isWebGLRenderer` on it. Forty hops, nothing. The
scene is held in a closure, which is where a sensible person would hold it.

**The devtools hook.** Three.js dispatches an `observe` event to
`window.__THREE_DEVTOOLS__` when a Scene or a Renderer is constructed, so
installing a fake hook would hand me both objects. But it has to exist *before*
the bundle runs, and anything I execute runs after page load. Too late.

**The draw calls.** This is the one. The scene is unreachable, but every frame
it has to tell the GPU where everything is, and I can stand in the middle of
that conversation:

```js
const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
const orig = gl.drawElements.bind(gl);
gl.drawElements = function (...args) {
  const program = gl.getParameter(gl.CURRENT_PROGRAM);
  const loc = gl.getUniformLocation(program, 'modelViewMatrix');
  if (loc) rows.push(Array.from(gl.getUniform(program, loc)));
  return orig(...args);
};
```

Wrap `drawElements`, and for each call ask the currently-bound program what its
matrix uniforms are set to. One frame gives you every quad.

My first attempt asked for `modelMatrix` and captured nothing at all, which had
me convinced the site used instancing. It doesn't. `MeshBasicMaterial` with a
texture simply has no `modelMatrix` uniform — it only gets `modelViewMatrix` and
`projectionMatrix`. Enumerating the active uniforms first (`ACTIVE_UNIFORMS`,
then `getActiveUniform`) would have told me that in one call instead of three.

## What fell out

72 draw calls. Deduplicating the matrices gave 36. Clustering *those* by
proximity gave **18** — each image is drawn twice, as two coplanar quads 0.003
apart.

Decompose each matrix and:

- every quad is **0.9 x 1.2**. Not one is a different size.
- the positions sit at radius **3.658** from their common centre, varying by
  0.75%. It is a sphere, and a precise one.
- the centre is **11.97** from the camera — 3.27 times the radius.
- the rotation basis of every model-view matrix is **exactly** `[1,0,0]`,
  `[0,1,0]`.

That last one is the important detail. An identity rotation in *camera* space
means each plane has been turned to face the camera — they billboard. That is
why the images in a screenshot of the site are crisp axis-aligned rectangles
with no perspective skew, and it is the single fact that decided how I built
this: if nothing ever actually turns, you do not need WebGL. A `translate3d`
under a CSS `perspective` does the same job, and the images stay real `<img>`
elements.

I also scrolled it 500px and measured the sphere rotating 6.12°.

## The distribution, and being wrong about it

Nearest-neighbour distances across those 18 points vary by **2.4%**. That is
not a random scatter — that is 18 points placed almost perfectly evenly.

My first guess was a Fibonacci sphere, the standard golden-angle trick. Its
signature is that the points are evenly spaced in *height*, so I fitted every
candidate axis and measured how even the projections were. Best fit varied by
63%. Whatever they did, it wasn't that.

So Fibonacci became the seed rather than the answer. A relaxation pass — repel
each point from its neighbours, re-project onto the sphere, cool off over 60
iterations — takes the spread from ~25% down to **2.2% at n=18**. Against their
2.4%. And unlike a hand-placed 18, it works for any number of images.

## The helix, which was polite about it

k95 ships a **RINGS / SPIRAL** toggle in its own header, which is a nice
confirmation that "give it two or three arrangements" is a real design and not
something I invented.

Same instrumentation, and the numbers are almost suspiciously round. Sorted by
height, consecutive images sit **0.5833** apart vertically and **30.0°** apart
around the axis. 360 / 30 = 12 images per turn. 12 x 0.5833 = **7.0** of rise
per revolution, on a cylinder of radius ~5.53.

Two honest caveats. The first: I wrote in my notes that k95's planes billboard
like the sphere's do. I never checked. I verified identity rotation bases on
*gionatannese's* quads and carried the assumption across without re-running the
probe — and looking at k95's own screenshot again, its images clearly skew in
perspective as they wrap, so they lie on the cylinder wall rather than facing
you. This rebuild billboards them anyway, which is now a deliberate choice
rather than something I measured.

The second: my fitted radius oscillated between 5.37 and 5.86 as a smooth
function of angle, which is the signature of a cylinder axis that isn't quite
where you think it is — the camera is tilted a few degrees. The radius is
constant; my axis was slightly off. Worth saying out loud, because a sinusoidal
error looks exactly like real variation if you don't ask why it's sinusoidal.

## The spiral had a seam, and I shipped it

The first build wrapped the helix the obvious way: take the image index modulo
n so one that climbs off the top comes back at the bottom. Endless screw, done.

Except it wasn't. The spiral rendered as **two separate diagonal bands with a
visible gap** — which I looked straight at in a screenshot and read as "a bit
loose" rather than "broken".

For a helix to actually close on itself, n images have to complete a **whole
number of turns**. At 12 per turn, 30 images is 2.5 turns. The seam lands half
a turn out of phase, so the thread restarts on the opposite side of the
cylinder from where it left off. The angle was continuous and the height
wrapped, and those two facts only agree when the turns come out whole.

The fix bends the angular step to the nearest whole number of turns rather than
holding 30° rigidly. The measured **pitch per turn survives exactly** — 1.266
at every n — and when n *is* a multiple of 12 nothing bends at all:

| n | turns | step | pitch/turn |
|---|---|---|---|
| 24 | 2 | **30.000°** | 1.266 |
| 30 | 3 | 36.000° | 1.266 |
| 36 | 3 | **30.000°** | 1.266 |

The test is that across every consecutive pair *including across the wrap*
there is exactly one step value and one rise value. There is.

So the demo uses 36 images instead of 30, which is 3 clean turns at the
measured 30° with nothing adjusted to make it fit.

## Then Chrome spent an hour lying to me

I had the maths right on the first try. The sphere came up at the correct radius
with the correct perspective ratio. And most of the images rendered as **blank
white cards**.

Not missing. Not broken. Correctly positioned, correctly sized, casting correct
box-shadows, containing nothing.

Every check said they were fine:

```
{ total: 30, loaded: 30, broken: 0 }
```

`complete: true`, `naturalWidth: 540`, HTTP 200, `image/webp`.

I chased this through four wrong theories. `loading="lazy"` not firing for
3D-transformed elements — plausible, wrong, `eager` changed nothing.
`transform-style: preserve-3d` overwhelming the compositor — that one is *real*
and I fixed it anyway, but it wasn't this. `will-change: transform` to stop
per-frame re-rasters — made it dramatically worse, down to three images. Screenshot
capture artifacts — genuinely misleading, because downscaled captures showed
fewer images than full-resolution ones, which sent me off for a while.

The test that actually settled it was forcing `background: red` on every image:

> If the cards turn red, the elements paint and it is the image *content*
> specifically that doesn't.

They turned red. Fifteen red rectangles and thirteen photographs.

**Chrome defers decoding images whose transform changes every frame, and under
continuous animation it will defer forever.** The element is loaded. Its box
paints. The bitmap is never produced. You get a perfectly laid-out gallery of
blank rectangles and every diagnostic you can think of tells you everything is
fine.

The fix is four lines — decode everything up front, before the loop starts:

```js
await Promise.all(images.map((src) => {
  const img = new Image();
  img.src = src;
  return img.decode().catch(() => undefined);
}));
```

## One more, quieter bug

My first pass faded the back of the sphere out with opacity, at 0.55. On a dark
background that reads as depth. On the reference's **white** background it reads
as the images dissolving into the page.

Then I went back to the measurements: the reference doesn't fade at all. Depth
comes entirely from perspective scale and from images covering each other.
Default is now 0.18, and mostly you want it lower.

Measuring the geometry and forgetting to measure the *treatment* is its own kind
of mistake.

## Take it

```bash
cd 002-image-sphere && npm install && npm run dev
```

`src/gallery/` is self-contained. React, no other dependencies, no WebGL. Drag
to orbit, scroll to roll the sphere or drive the screw, and the three
arrangements morph into each other because they are the same 36 points
parameterised three ways.

The spiral and the rings also take an `axis` — vertical stands the thread up as
a column you screw down through, horizontal lays it across the screen. It costs
one function:

```ts
function onAxis(p: Point, axis: Axis): Point {
  return axis === "vertical" ? p : { x: p.y, y: p.x, z: p.z };
}
```

Which is the nice thing about keeping the layouts as pure functions of an
index: a whole extra orientation is a coordinate swap, not a second code path.

---

## The Instagram cut

**Hook (first 2s):** "This site has no images in it. Zero. Watch."

**Caption:**

> I wanted to rebuild this image sphere, so I opened devtools and searched for
> the images.
>
> `document.querySelectorAll('img')` → **0**.
>
> It's WebGL. One canvas, and every photo is a texture that only exists as
> numbers inside a closure. Nothing to inspect. No DOM. No scene on `window`.
>
> So I wrapped the function the GPU gets called with. Every frame the site has
> to tell the graphics card where each image is — and I stood in the middle of
> that conversation and wrote it down.
>
> 72 draw calls → 36 matrices → 18 images. Each one exactly 0.9 x 1.2. All 18
> at radius 3.658, varying by less than 1%. Camera exactly 3.27x the radius
> back.
>
> And every single rotation came back as *identity* — meaning the images always
> face you, they never actually turn. Which is the whole trick: if nothing
> rotates, you don't need WebGL at all. I rebuilt it in plain CSS.
>
> Then Chrome spent an hour insisting 30 loaded images were fine while
> rendering them as blank white cards. Turns out it refuses to decode images
> whose transform changes every frame. Four lines to fix. Story's in the repo.
>
> Second site (@k95) had a spiral: exactly 30° and 0.5833 of rise between
> images. 12 per turn. Both modes are in the build.
>
> Code in the repo — link in bio.
>
> #webgl #threejs #frontend #react #creativecoding #webdesign

**Slides:**

1. The sphere, spinning. "Beautiful. Let's steal the maths."
2. Devtools: `querySelectorAll('img')` → `0`
3. The `drawElements` wrap, 6 lines, highlighted
4. The dump: 72 → 36 → 18, with the radius column all reading 3.65x
5. `basis: [1,0,0] [0,1,0]` — "identity. they never rotate."
6. "So: no WebGL." The CSS `translate3d` version side by side
7. The blank white cards + `{ loaded: 30, broken: 0 }`
8. The red-background test — 15 red rectangles
9. Fixed, all three modes morphing, light → dark
10. Repo + "what should I pull apart next?"
