# Diagonal Carousel

A carousel whose slots run along a single diagonal from the bottom right to the
top left. Every switch moves each object one slot up that diagonal **and**
rotates it by the same step, so position and rotation are one motion: an object
is upright only while it is at the centre, and leans further the further it is
from it.

Objects that can be switched on — a lamp, a phone, a CRT — flicker to life as
they arrive at the centre and gutter out as they leave.

```
                                   ·
                          ╲   ╲   ╲
   top-left    ⟵      ╲  -30° ╲ -15° ╲  0°  ╲ +15° ╲     ⟶   bottom-right
                                    upright
```

## Running it

```bash
npm install
npm run dev
```

## Using the component

```tsx
import { DiagonalCarousel } from "./carousel/DiagonalCarousel";

<DiagonalCarousel
  interval={2200}        // ms between automatic switches
  autoPlay
  sensitivity={2.4}      // slots travelled per 100px of wheel/drag
  captureWheel           // swallow the wheel so the page doesn't scroll too
  onCenterChange={(item) => setLabel(item.label)}
/>;
```

It fills its positioned parent, so give that parent a size.

### Objects

`src/carousel/items.ts` is the track, in order. A plain object needs `src`,
`size` (longest edge in design px) and `ratio`. An object that switches on adds
`litSrc` and a `glow` colour:

```ts
{
  id: "lamp",
  label: "Mushroom lamp",
  src: "/objects/lamp-off.webp",      // the resting state
  litSrc: "/objects/lamp-on.webp",    // hard-cut over the top when lit
  glow: "255, 186, 92",               // rgb triple for the light it throws
  size: 545,
  ratio: 726 / 900,
}
```

`litSrc` must be cut from the **same frame** as `src` — same crop, same object
position — or the object will appear to jump when it lights. The two source
renders here were made by generating the lit version and then editing only the
light out of it, and both were cropped to a single shared bounding box.

Keep the switchable objects spread through the array so a flicker lands roughly
every third switch rather than three in a row.

## How it works

Everything hangs off one number: `progress`, the track position in slots.

- **`geometry.ts`** — the track. `SLOT_STEP` is `(285, 195)` design px and
  `SLOT_ROTATION` is `15°`; both are measured off the reference this was built
  from. Item `i`'s signed slot is `i - progress`, wrapped into `[-n/2, n/2)` so
  it is recycled off-screen rather than sliding back through frame. The track is
  authored in a fixed 1920×1080 space and scaled to *cover* the viewport, which
  is what guarantees the recycling always happens out of sight.
- **`useCarouselTrack.ts`** — the engine. Auto-advance and scrolling both only
  move a *target*; one spring chases it every frame. That is why scrolling feels
  like the same carousel run faster instead of a second, separate behaviour, and
  why the per-slot effects fire identically either way. Wheel and touch deltas
  are projected onto the track axis, so only movement *along* the diagonal
  counts. On release the target snaps to a whole slot, so it always comes to
  rest with something upright.
- **`useFlicker.ts`** — runs `lit` through a timed on/off pattern instead of
  jumping to it. The lit layer is a hard cut, never a fade; a crossfade reads as
  a dissolve rather than as a switch being thrown.

Auto-advance is off by default under `prefers-reduced-motion`.

## Assets

The twelve objects in `public/objects` were generated with Higgsfield
(`nano_banana_2`) as isolated renders on a flat white field, then cut out with
`rembg` (`isnet-general-use`, alpha matting on) and trimmed to their alpha
bounding box. `.raw/` and `.cutlocal/` hold the full-resolution originals and
masters and are not committed.
