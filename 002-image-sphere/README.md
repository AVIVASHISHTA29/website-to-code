# Image Sphere

Images arranged in 3D on a **sphere** or an endless **helix** — drag to orbit,
scroll to roll the ball or drive the screw, and morph between the two. The helix
runs vertically as a column you screw through, or horizontally across the
screen. Light and dark.

No WebGL and no dependencies beyond React. Both references billboard their
images — every plane always faces the camera and never turns — and that is
exactly what `translate3d` under a CSS `perspective` gives you for free. So the
images stay real `<img>` elements.

## Running it

```bash
npm install
npm run dev
```

## Using the component

```tsx
import { ImageGallery } from "./gallery/ImageGallery";

<ImageGallery
  images={urls}          // any length
  mode="sphere"          // "sphere" | "spiral"
  axis="vertical"        // "vertical" | "horizontal" — spiral only
  imageHeight={132}      // everything else is sized from this
  ratio={0.75}           // image aspect, w / h
  depthFade={0.18}       // how much the back fades. keep it low.
/>;
```

It fills its positioned parent, so give that parent a size.

| prop | default | |
|---|---|---|
| `axis` | `"vertical"` | Which way the helix axis points. Vertical stands it up as a column you screw through; horizontal lays it across the screen. The sphere ignores it. |
| `imageHeight` | `132` | Height of one image in px. The radius is `3.05x` this. |
| `ratio` | `0.75` | Image aspect. The reference used `0.9 / 1.2`. |
| `depthFade` | `0.18` | Opacity lost at the very back. |
| `dragSpeed` | `0.32` | Degrees of orbit per pixel dragged. |
| `wheelSpin` | `0.0122` | Degrees of roll per pixel of wheel. Measured. |
| `wheelTravel` | `0.9` | Images travelled per 100px of wheel, in spiral mode. |
| `idleSpin` | `3.2` | Degrees per second it drifts when untouched. |
| `friction` | `0.94` | Per-frame momentum retention after a throw. |

## The numbers

Everything in `layouts.ts` marked "measured" was read off the live reference by
intercepting its WebGL draw calls and decomposing the matrices — not estimated
from a screenshot. Both sites are Three.js, so there is no DOM to inspect; the
geometry only exists as uniforms. Wrapping `gl.drawElements` and reading
`modelViewMatrix` back with `gl.getUniform` gets you every quad's position,
scale and orientation for one frame.

**Sphere**, from [gionatannese.com](https://www.gionatannese.com/):

| | |
|---|---|
| images | 18 (72 draw calls → 36 matrices → 18 positions, each drawn twice) |
| plane size | `0.9 x 1.2`, identical on every one |
| radius | `3.658`, varying by only 0.75% |
| camera | `11.97` from centre → **3.27x the radius** |
| billboarded | yes — model-view rotation basis is exact identity on every quad |
| spacing | nearest-neighbour CV **0.024** |
| wheel | 6.12° per 500px → **0.0122°/px** |

**Helix**, from [k95.it](https://k95.it/en) (whose own header offers it as one of two arrangements).
Note that only positions were measured here — unlike the sphere, k95's planes are
*not* billboarded; they lie on the cylinder wall and skew with it. This rebuild
billboards them anyway, which is a deliberate difference, not a finding:

| | |
|---|---|
| radius | `~5.53` |
| step | `0.5833` of rise and **exactly 30.0°** between consecutive images |
| → | **12 images per turn**, `7.0` of rise per turn |
| pitch / radius | **1.266** |

## How the sphere is built

A golden-angle (Fibonacci) sphere is the textbook way to spread n points evenly,
but its points are evenly spaced in *height*, which bands visibly near the poles
— and the reference does not have that signature (its projections onto the best
candidate axis vary by 63%). So Fibonacci is only the seed. `relax()` then
repels each point from its neighbours and re-projects onto the sphere, cooling
off over ~60 passes.

That takes nearest-neighbour spread from ~25% down to **2.2% at n=18**, against
the reference's 2.4%. It also works for any n, which the reference's hand-tuned
18 does not have to.

## Closing the helix

The helix wraps — an image that climbs off one end comes back at the other — and
for the thread to actually join up there, n images have to close a **whole
number of turns**. The measured 12-per-turn only does that when n is a multiple
of 12. At n = 30 you get 2.5 turns, the seam lands half a turn out of phase, and
the spiral visibly breaks into two separate bands with a gap between them.

So `spiralStep()` bends the angular step to the nearest whole number of turns
instead. The measured **pitch per turn stays exactly 1.266** either way; only
the images-per-turn shifts, and not at all when n is a multiple of 12:

| n | turns | step | rise | pitch/turn |
|---|---|---|---|---|
| 24 | 2 | **30.000°** | 0.105 | 1.266 |
| 30 | 3 | 36.000° | 0.127 | 1.266 |
| 36 | 3 | **30.000°** | 0.105 | 1.266 |

Across every consecutive pair *including the wrap* there is exactly one step
value and one rise value, which is what makes the thread continuous. The demo
uses **36** images so it runs at the measured 30° with nothing bent to fit.

## Two things that will bite you

**Chrome will not decode images whose transform changes every frame.** They
report `complete: true` with a real `naturalWidth`, their box paints, their
box-shadow paints — and the picture inside never appears. You get perfectly
placed blank cards. The fix is to `await img.decode()` on every image up front,
before the loop starts; see the preload effect in `ImageGallery.tsx`.

**`transform-style: preserve-3d` does not scale.** It is the obvious way to get
depth sorting for free, but it puts all n images into one 3D rendering context,
and past a couple of dozen layers Chrome stops rastering most of them — the same
blank-card symptom, from a different cause. Since every image is billboarded
there is no real 3D orientation to preserve, so the stage stays flat, the
perspective lives on the images' direct parent, and sorting by z into `zIndex`
costs one line.

Adding `will-change` to "help" makes both worse.

## Assets

The 36 photos in `public/images` are placeholders from
[picsum.photos](https://picsum.photos), which serves photographs from Unsplash
under the [Unsplash licence](https://unsplash.com/license). Resized to 540x720
and converted to WebP. Bring your own.
