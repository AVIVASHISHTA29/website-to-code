import { useEffect, useMemo, useRef, useState } from "react";
import {
  SPHERE,
  ringsLayout,
  sphereLayout,
  spiralLayout,
  spiralReach,
  type Axis,
  type Mode,
  type Point,
} from "./layouts";
import { rotate, useGalleryMotion, type MotionOptions } from "./useGalleryMotion";
import "./gallery.css";

export type ImageGalleryProps = MotionOptions & {
  images: string[];
  mode?: Mode;
  /**
   * Which way the axis of the spiral and rings points. Ignored by the sphere.
   * Vertical stands the thread up as a column you screw through; horizontal
   * lays it across the screen.
   */
  axis?: Axis;
  /** Height of one image, in px. Everything else is sized from this. */
  imageHeight?: number;
  /** Aspect ratio of the images (w / h). The reference used 0.9/1.2. */
  ratio?: number;
  /**
   * How much the back of the arrangement fades. Keep this low: the reference
   * does not fade at all, reading depth purely through perspective scale and
   * occlusion. On a light ground anything above ~0.25 washes the back images
   * out to nothing rather than pushing them away.
   */
  depthFade?: number;
  className?: string;
};

/**
 * How each arrangement is framed: `spread` is its radius as a multiple of the
 * sphere's, `camera` its viewing distance as a multiple of that radius.
 *
 * The sphere's 3.27 is measured (11.97 / 3.658) and gives the gentle,
 * almost-flat perspective the reference has. The helix wants the camera much
 * closer, and a tighter radius — at the sphere's radius it fills the width of
 * the screen and only a third of a turn is on screen at once, which reads as a
 * band of images rather than a thread. Narrow it and several turns fit, and it
 * reads as what it is.
 */
type Frame = { spread: number; camera: number };

const FRAME: Record<Mode, Record<Axis, Frame>> = {
  sphere: {
    vertical: { spread: 1, camera: SPHERE.cameraPerRadius },
    horizontal: { spread: 1, camera: SPHERE.cameraPerRadius },
  },
  spiral: {
    vertical: { spread: 0.62, camera: 1.95 },
    horizontal: { spread: 0.74, camera: 2.0 },
  },
  rings: {
    vertical: { spread: 0.95, camera: 2.5 },
    horizontal: { spread: 0.95, camera: 2.5 },
  },
};

/** Seen very slightly from above, so rings read as ellipses and not as lines. */
const RESTING_PITCH = -11;

/**
 * Images arranged on a sphere, an endless helix, or stacked rings — drag to
 * orbit, wheel to roll the ball or drive the screw.
 *
 * There is no WebGL here. Both references billboard their images, meaning every
 * plane always faces the camera and never turns, and that is exactly what a
 * plain `translate3d` under a CSS `perspective` gives you for free. So the
 * images stay real `<img>` elements: selectable, lazy-loadable, and readable by
 * a screen reader.
 */
export function ImageGallery({
  images,
  mode = "sphere",
  axis = "vertical",
  imageHeight = 132,
  ratio = 0.75,
  depthFade = 0.18,
  className,
  ...motionOptions
}: ImageGalleryProps) {
  const { surface, motion, dragging } = useGalleryMotion(mode, motionOptions);
  const items = useRef<(HTMLElement | null)[]>([]);
  const stage = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const n = images.length;

  const radius = imageHeight * SPHERE.radiusPerImageHeight;

  // The sphere needs relaxing and the rings need no per-frame work, so both are
  // built once. Only the helix moves under its own power.
  const staticLayouts = useMemo(
    () => ({ sphere: sphereLayout(n), rings: ringsLayout(n, 4, axis) }),
    [n, axis],
  );

  /**
   * Decode every image before showing any of them.
   *
   * Left to itself the browser decodes lazily, and for images whose transform
   * changes every frame it will keep deferring the decode indefinitely — the
   * `<img>` reports complete with a real naturalWidth, its box paints, and the
   * picture inside it never appears. Awaiting decode() puts the bitmap in the
   * cache up front, which both fixes that and stops the gallery popping in
   * image by image.
   */
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    Promise.all(
      images.map((src) => {
        const img = new Image();
        img.src = src;
        return img.decode().catch(() => undefined);
      }),
    ).then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [images]);

  useEffect(() => {
    let raf = 0;
    const reach = spiralReach(n);

    const layoutFor = (m: Mode, travel: number): Point[] =>
      m === "spiral" ? spiralLayout(n, travel, axis) : staticLayouts[m];

    const draw = () => {
      const s = motion.current;
      const from = layoutFor(s.from, s.travel);
      const to = layoutFor(s.mode, s.travel);
      // Ease the morph so arrangements settle rather than arrive.
      const t = s.morph >= 1 ? 1 : 1 - Math.pow(1 - s.morph, 3);
      const a = FRAME[s.from][axis];
      const b = FRAME[s.mode][axis];
      const spread = a.spread + (b.spread - a.spread) * t;
      const cam = a.camera + (b.camera - a.camera) * t;
      if (stage.current) {
        stage.current.style.perspective = `${(radius * spread * cam).toFixed(0)}px`;
      }

      for (let i = 0; i < n; i++) {
        const el = items.current[i];
        if (!el) continue;

        const a = from[i];
        const b = to[i];
        const unit = {
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
          z: a.z + (b.z - a.z) * t,
        };

        const p = rotate(
          {
            x: unit.x * radius * spread,
            y: unit.y * radius * spread,
            z: unit.z * radius * spread,
          },
          s.yaw,
          s.pitch + RESTING_PITCH,
          s.roll,
        );

        // Depth is carried by perspective scale and by the images covering
        // each other. Opacity only takes the very back edge off.
        const depth = (p.z / (radius * spread) + 1) / 2;
        let opacity = 1 - depthFade * (1 - depth);

        // Fade the ends of the helix so the wrap is never seen.
        if (t > 0.5 && s.mode === "spiral") {
          // Only bite once an image is already leaving the frame, so the
          // wrap is hidden without dimming anything you can actually see.
          const along = axis === "vertical" ? unit.y : unit.x;
          const edge = Math.abs(along) / reach;
          if (edge > 0.86) opacity *= Math.max(0, 1 - (edge - 0.86) / 0.14);
        }

        el.style.transform = `translate3d(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px, ${p.z.toFixed(2)}px)`;
        el.style.opacity = opacity.toFixed(3);
        // Standing in for preserve-3d: nearer images paint over farther ones.
        el.style.zIndex = String(2000 + Math.round(p.z));
      }
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [n, radius, depthFade, staticLayouts, motion, axis]);

  return (
    <div
      ref={surface}
      className={["ig-surface", ready && "is-ready", dragging && "is-dragging", className]
        .filter(Boolean)
        .join(" ")}
      role="group"
      aria-label={`${n} images arranged as a ${mode}. Drag to rotate.`}
    >
      <div className="ig-stage" ref={stage}>
        {images.map((src, i) => (
          <figure
            key={src}
            className="ig-item"
            ref={(el) => {
              items.current[i] = el;
            }}
            style={{ width: imageHeight * ratio, height: imageHeight }}
          >
            <img src={src} alt="" loading="eager" draggable={false} />
          </figure>
        ))}
      </div>
    </div>
  );
}
