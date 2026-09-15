# 003 — The particle blob

A point cloud on a sphere, deformed in the vertex shader, with an optional
frosted-glass shell over the top. Raw WebGL2, React, and nothing else.

Rebuilt from [vanlent.dev](https://vanlent.dev/). The write-up is in
[`blog/003-the-particle-blob.md`](../blog/003-the-particle-blob.md).

```bash
npm install
npm run dev
```

That opens the studio: every parameter on a slider, ten presets, and a button
that hands you the JSX for whatever you just made.

## Using it

Copy `src/blob/` into your project. It has no dependencies beyond React.

```tsx
import { Blob, WOBBLE } from './blob'

<Blob
  wobbleFrom={WOBBLE.ORGANIC}
  wobbleTo={WOBBLE.SPIKE_BURST}
  wobbleBlend={0.189}
  noiseAmount={0.193}
  lockShell={0.51}
/>
```

The component fills its parent, so give that parent a size. Every prop is
optional and falls back to `DEFAULT_CONFIG`.

### The shape

| Prop | Default | What it does |
|---|---|---|
| `wobbleFrom` | `WOBBLE.ORGANIC` | Displacement field to blend from |
| `wobbleTo` | `WOBBLE.ORGANIC` | Displacement field to blend to |
| `wobbleBlend` | `0` | 0 = fully *from*, 1 = fully *to* |
| `noiseAmount` | `0.3` | Radial displacement amplitude, outermost layer |
| `lockShell` | `0.25` | How hard the outermost layer is pinned to the sphere |
| `curlAmount` | `0` | Tangential curl advection — surface flow |
| `curlFrequency` | `0.05` | Curl field frequency |
| `scale` | `1` | Overall size |

The seven wobbles: `ORGANIC`, `SPIKY`, `SHATTER`, `SPIKE_BURST`, `CORONA`,
`CUBE_LATTICE`, `NEBULA`. Any two crossfade, which is where most of the range
lives — `ORGANIC → CORONA` at 0.3 is a different object from either end.

### The cloud

| Prop | Default | What it does |
|---|---|---|
| `count` | `30000` | Points per layer |
| `layers` | `3` | Stacked shells |
| `pointSize` | `1.1` | Point size in CSS pixels at the centre |
| `opacity` | `0.4` | Base particle alpha |
| `softSprites` | `0` | 0 = hard dot, 1 = soft sprite |
| `rimIntensity` | `0` | Fresnel brightening at the silhouette |
| `color` | `'#e6ebf5'` | Particle colour |
| `background` | `'#0b0c10'` | Page colour behind the blob |

### Motion and interaction

| Prop | Default | What it does |
|---|---|---|
| `timeScale` | `1` | Animation rate |
| `autoSpin` | `0.08` | Idle spin, radians per second |
| `dragToOrbit` | `true` | Grab and spin, with inertia |
| `clickToMorph` | `false` | Click crossfades `wobbleBlend` end to end |
| `mouseMode` | `'repel'` | `'none'`, `'repel'` or `'attract'` |
| `mouseIntensity` | `0.2` | Cursor push strength |
| `mouseRadius` | `1.2` | Cursor influence radius, in sphere radii |

### Glass

| Prop | Default | What it does |
|---|---|---|
| `glass` | `false` | Render the frosted shell |
| `glassRadius` | `0.82` | Shell radius relative to the sphere |
| `glassRefraction` | `0.35` | How hard the view bends through it |
| `glassFrost` | `8` | Blur radius in pixels |
| `glassDispersion` | `3` | Chromatic split at the edge, in pixels |
| `glassRim` | `0.6` | Fresnel edge brightness |
| `glassSpecular` | `0.5` | Highlight strength |
| `glassTint` / `glassTintMix` | `'#cfe4ff'` / `0.18` | Body tint |

## How it works

One buffer of 30,000 points sampled uniformly over the unit sphere. Equal-area
sampling — pick `y` uniformly in `[-1, 1]`, then a uniform azimuth — so the
points do not crowd at the poles the way naive spherical coordinates do.

Every frame, each layer draws **that same buffer** with a different row of
uniforms. Nothing about the geometry changes; the shape is entirely a vertex
shader reading `position`. Per layer, in order:

1. Blend the two wobble fields and push each point along its own radius.
2. Advect tangentially through a curl-noise field, four integration steps.
3. Mix back toward the unit shell by `lockShell`.
4. Push away from or toward the cursor.

The layer stack is where the volume comes from. Layer *i* uses
`noise0 × 0.8ⁱ` and pins to the shell by `1 − (1 − lock0) × 0.85ⁱ`, so outer
shells move most and are least constrained while inner ones sit tight. Both
constants were measured, not chosen — see the blog post.

With `glass` on there are three more passes: the cloud renders to a texture, a
separable gaussian blurs a half-resolution copy, and a full-screen shader
reconstructs a sphere normal per pixel and samples the cloud back through it
with a refraction offset, a per-channel dispersion split, a Fresnel edge and a
specular cap.

### What is measured and what is not

Measured off the live page, by hooking `gl.drawArrays` and dumping the active
uniforms and buffers per draw call:

- The point distribution, and that layers share one buffer
- `0.8` and `0.85` layer falloff, to six decimal places
- The seven wobble names and their dispatch IDs, including that 5–7 are dead
- `wobbleOrganic` itself: `snoise(vec4(pos / 1.5, time))`
- The cursor defaults, `0.2` intensity and `1.2` radius
- Every preset marked `measured` in `presets.ts`

Ours, and deliberately different:

- **Six of the seven wobble bodies.** Only the names, IDs and on-screen effect
  were readable. These are our implementations of what each name describes.
- **`WOBBLE_GAIN = 0.3`** in the vertex shader. How the original scales
  `uNoiseAmount` into displacement was not readable, and taking it as a
  straight fraction of the radius blows the cloud into radial streaks an order
  of magnitude longer than the real thing.
- **Iterated curl advection.** Four steps, not one. One step cannot produce
  flow ridges — curl noise is divergence-free, so it moves every particle and
  bunches none of them.
- **The glass shell.** vanlent.dev has no glass pass at all.
- **Raw WebGL2.** The original is Three.js r180 under React Three Fiber. Going
  direct keeps the folder dependency-free.

## Notes

The blob defaults to light particles on a near-black page. The studio's own
chrome follows `background` rather than the OS theme — the canvas fills the
screen, so a light blob under a dark system theme would otherwise paint
near-white labels onto a near-white page.

`prefers-reduced-motion: reduce` freezes the blob completely — no spin, no
breathing, no cursor response. That is deliberate, but it does mean the
interaction is gone rather than merely calmed.

Rendering is capped at `devicePixelRatio` 2. At 30,000 points × 3 layers the
cost is fill rate, not vertices, so the cap matters more than the count.

## Credit

[vanlent.dev](https://vanlent.dev/) — Tim van Lent, Amsterdam. Go and look at
the original; the restraint in it is the hard part.

Simplex noise is Ian McEwan / Ashima Arts, MIT
([webgl-noise](https://github.com/ashima/webgl-noise)) — the same
implementation the original credits in its own shader header.
