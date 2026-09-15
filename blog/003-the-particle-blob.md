# 003 — Seven blobs that turn out to be one blob

**Source:** [vanlent.dev](https://vanlent.dev/)
**Code:** [`003-particle-blob/`](../003-particle-blob/)

---

There are blobs all down this page. A grainy ball in the hero. Something with
maze-like flow patterns crawling over its surface further down. A spiky one
that looks like it is exploding. They read as three different toys someone
built for three different sections.

They are the same 30,000 points. The only thing that changes is a row of
numbers.

That is the whole episode, and I want to be clear that I did not guess it — it
came out of the uniform list, in one go, the moment I finally got a draw call
to stop.

## Getting to the draw call took four wrong turns

Episode 002 established the technique: the scene lives in a closure, so wrap
`gl.drawArrays` and ask the currently-bound program what its uniforms are set
to. I went in expecting fifteen minutes.

**Wrong turn one.** Zero draw calls. Not a few — zero, across every hook I
tried, while the sphere sat there visibly rendering. I checked `isContextLost`,
checked for WebGPU, checked for `transferControlToOffscreen`, went looking for
canvases in shadow roots. All fine, all present, all drawing nothing.

The tab was **backgrounded**. Chrome pauses `requestAnimationFrame` in hidden
tabs, so the page's render loop simply was not running; what I was looking at
was the last frame it drew before I switched away. `document.visibilityState`
said `hidden` and I had not thought to ask.

The fix is that a CDP screenshot forces a frame. So: install the hook, take a
screenshot, read the results — all in one batch, so the page never gets a
chance to go idle between them.

**Wrong turn two**, immediately after: still zero. This one was mine. My first
attempt had hooked the context *instance*, then "restored" it with
`gl.drawArrays = original`. That does not restore anything — it leaves an own
property on the context object shadowing the prototype. Every later attempt to
patch `WebGL2RenderingContext.prototype` was landing underneath a property that
was already there.

```js
Object.getOwnPropertyNames(gl)
// ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']
```

Four own properties on a WebGL context, all of them mine. `delete` them and the
prototype patch fires on the next frame.

## Then everything at once

```
count: 6000, mode: POINTS, attributes: ['position', 'uv']
uniforms: uTime uTimeScale uNoiseAmount uShapeType uMouse uMouseMode
  uMouseIntensity uMouseRadius uCurlNoiseAmount uCurlFrequency uScale
  uIsMobile uWobbleTypeFrom uWobbleTypeTo uWobbleBlend uTurbulenceTangential
  uLockShell uFlowColorMix uIsDustLayer uDustVisibility uFlowColor
  uSoftSprites uShellTint uShellTintMix uColorMix uRimIntensity uThemeLight
  uSpecialBlend
```

Two attributes. `position` and `uv`. Every bit of the motion is a vertex shader
reading a static buffer.

And `uWobbleTypeFrom`, `uWobbleTypeTo`, `uWobbleBlend` — not a wobble setting,
a **crossfade between two wobble settings**. The shape is a dissolve.

Pulling the function list out of the shader source gave the catalogue:

| ID | Name |
|---|---|
| 0 | `ORGANIC` — smooth simplex noise breathing (default) |
| 1 | `SPIKY` — sharp crystalline protrusions |
| 2 | `SHATTER` — broken glass with sharp angular fragments |
| 3 | `SPIKE_BURST` — random particle spikes emerging from surface |
| 4 | `CORONA` — solar flare-like spikes radiating dynamically |
| 5–7 | `return 0.0; // reserved IDs 5–7 (removed wobble types)` |
| 8 | `CUBE_LATTICE` |
| 9 | `NEBULA` — lab wobble |

Three of those IDs are a graveyard, left in the dispatch so the numbering never
shifts. I kept the gap for the same reason.

I caught one mid-morph, which is the nicest single piece of evidence in the
whole episode:

```
uWobbleTypeFrom: 0    uWobbleTypeTo: 3    uWobbleBlend: 0.189
```

Scroll position driving an 18.9% dissolve from *organic* toward *spike burst*.

## The two numbers

Each blob draws several times per frame. I assumed those were separate objects
until I read the position buffers back off the GPU with `getBufferSubData` and
found all four **byte for byte identical**. One buffer, several draws, different
uniforms. The layers are not different clouds — they are the same cloud wearing
different settings.

And the settings step:

```
uNoiseAmount   0.2988160  0.2390528  0.1912422     ratio 0.800000  0.800000
1 - uLockShell 0.4506252  0.3830315  0.3255768     ratio 0.850000  0.850000
```

Noise falls off by exactly **0.8** per layer. The gap to a fully locked shell
falls off by exactly **0.85**. Six decimal places, on two different blobs in
two different sections.

So the outer shell is the loosest and moves most, and each shell inward is
quieter and more tightly pinned to the sphere. That nesting is the entire reason
the thing reads as a volume instead of a flat disc, and it is two constants.

While I was in there: the point distribution is uniform-random on the unit
sphere, radius exactly 1.0000, with `y` uniform over `[-1, 1]` — quartiles came
back `-0.9995 / -0.5016 / -0.0023 / 0.5298 / 0.9989`. Equal-area sampling, not
a Fibonacci lattice. I checked for the golden angle specifically, because the
flow-pattern blob *looks* like a phyllotaxis spiral, and consecutive azimuths
came back `1.54, 3.70, 4.12, 4.01, 5.90` against a golden angle of `2.39996`.
Not it.

That spiral look is `uCurlNoiseAmount 0.78, uCurlFrequency 0.36, uLockShell 1.0`
— curl noise dragging particles *along* the shell rather than off it. Same
random cloud, rearranged.

## Two things I got wrong in the rebuild

**The gain.** I took `uNoiseAmount` at face value, as a fraction of the radius.
A measured 0.161 therefore moved points by ±16% of the radius — and the result
was a dandelion, all radial streaks, nothing like the tight grainy ball on the
real page. The silhouette was smooth, which proved the noise field was fine, so
it had to be the amplitude.

The original's mapping from `uNoiseAmount` into actual displacement was not in
anything I could read. So this one is a calibration, not a measurement:
`WOBBLE_GAIN = 0.3`, chosen as the value where the measured 0.161 reproduces
the hero's gentle lumpy circle, and it is commented as such in the shader. I
would rather have an honest constant than a fake one.

**Curl noise cannot bunch particles.** I wrote the surface flow as one
advection step along a curl field, and got an evenly grainy ball with no
pattern in it whatsoever. Which is exactly correct and exactly useless: curl
noise is divergence-free *by construction*. That is the property people choose
it for. Advect a uniform cloud through it and you move every particle and
crowd none of them.

Ridges need the flow **integrated** — re-sample the field at each new position
and step again. Four steps and the fingerprint pattern appears. The thing that
made the effect work was the thing I had been taught to avoid.

## The part that is not theirs

vanlent.dev has no glass. The frosted shell is mine, and it is three extra
passes: render the cloud to a texture, blur a half-resolution copy, then run a
full-screen shader that reconstructs a sphere normal per pixel, samples the
cloud back through it with an offset that grows toward the rim, splits the
three channels along that normal for dispersion, and finishes with a Fresnel
edge and a specular cap.

The rest of the studio is just exposing what was already there. Every uniform
on a slider, the measured rows as presets, and a button that writes out the
JSX. The site already had a blob maker in it — it just never showed anyone.

## Instagram cut

**Hook:** "This site has three different blobs. Except it doesn't."

**Caption:**

> Three blobs on this page. A grainy one, a swirly one, a spiky one. Three
> different things, right?
>
> Same 30,000 points. Every time.
>
> I hooked the draw calls and dumped the uniforms, and the whole design was
> sitting there in the variable names: uWobbleTypeFrom, uWobbleTypeTo,
> uWobbleBlend. Not a shape setting — a *crossfade between two shape settings*.
> Seven of them: organic, spiky, shatter, spike burst, corona, cube lattice,
> nebula. Plus three dead IDs left in the dispatch as a graveyard.
>
> Caught one mid-morph: from 0, to 3, blend 0.189. Scroll driving an 18.9%
> dissolve.
>
> Then the good bit. Each blob draws 3-4 times a frame and I assumed those were
> separate objects — read the buffers back off the GPU and they were byte for
> byte identical. Same cloud, different settings. Noise falls off by exactly
> 0.8 per layer. Shell lock by exactly 0.85. Six decimal places.
>
> Two constants. That's the whole sense of depth.
>
> Took me four wrong turns to get there — including an hour where the tab was
> just *backgrounded* and Chrome had paused the render loop.
>
> Built the maker they never shipped. Every uniform on a slider, plus a frosted
> glass shell that isn't theirs. Code in the repo.
>
> #webgl #glsl #creativecoding #frontend #shaders #threejs #webdesign

**Slides:**

1. The three blobs side by side. "Three different effects."
2. "Same 30,000 points." Same three, now labelled with their uniform rows.
3. `document.visibilityState → 'hidden'` — "an hour lost to a background tab"
4. `Object.getOwnPropertyNames(gl)` showing my own four leftover properties
5. The uniform dump, `uWobbleTypeFrom / To / Blend` highlighted
6. The seven-name table, with 5–7 as `// removed wobble types`
7. `from: 0, to: 3, blend: 0.189` — caught mid-morph
8. The falloff columns: `0.800000 0.800000` / `0.850000 0.850000`
9. The dandelion failure next to the real thing — "I trusted the number"
10. Curl noise, one step vs four. "Divergence-free. It can't bunch."
11. The glass blob, dark preset, slowly turning
12. The studio, sliders moving, code panel open
13. Repo + "what should I pull apart next?"
