/**
 * The three arrangements, and the constants behind them.
 *
 * Every number marked "measured" was read off the live reference by
 * intercepting its WebGL draw calls and decomposing the matrices — not
 * estimated from a screenshot. Both references billboard their images (the
 * model-view rotation basis came back as exact identity on every quad), which
 * is why none of these layouts carry a rotation: an image only ever moves, it
 * never turns.
 */

export type Point = { x: number; y: number; z: number };

/**
 * Which way the axis of a cylindrical arrangement points.
 *
 * "vertical" stands it up the screen — a column you screw up and down through.
 * "horizontal" lays it across the screen, so the thread runs left to right and
 * you are looking at the side of it.
 *
 * Only the spiral has an axis; the sphere ignores it.
 */
export type Axis = "vertical" | "horizontal";

/** Lays a Y-axis arrangement over onto the X axis. */
function onAxis(p: Point, axis: Axis): Point {
  return axis === "vertical" ? p : { x: p.y, y: p.x, z: p.z };
}

/** Scene units. Everything below is expressed relative to this. */
export const UNIT = 1;

/* ------------------------------------------------------------------ sphere */

/**
 * Measured on gionatannese.com: 18 planes of 0.9 x 1.2 on a sphere of radius
 * 3.658, camera 11.97 away. What matters is the ratios, which hold at any size:
 */
export const SPHERE = {
  /** radius / image height — 3.658 / 1.2 */
  radiusPerImageHeight: 3.05,
  /** camera distance / radius — 11.97 / 3.658 */
  cameraPerRadius: 3.27,
  /** Their nearest-neighbour spacing varied by only 2.4%. See relax(). */
  targetNeighbourCV: 0.024,
} as const;

/**
 * Golden-angle sphere. Even, deterministic, and defined for any n — but its
 * points are evenly spaced in *height*, which leaves visible banding near the
 * poles. The reference does not have that signature, so this is only the seed.
 */
function fibonacciSphere(n: number): Point[] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: n }, (_, i) => {
    const y = n === 1 ? 0 : 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    return { x: Math.cos(theta) * r, y, z: Math.sin(theta) * r };
  });
}

/**
 * Pushes points apart along the sphere surface until they are evenly spaced.
 * Each point is repelled by its neighbours and re-projected onto the sphere;
 * a few dozen passes take the nearest-neighbour spread from ~25% down to the
 * couple of percent the reference shows.
 */
function relax(points: Point[], iterations = 60, strength = 0.35): Point[] {
  const p = points.map((q) => ({ ...q }));
  const n = p.length;
  if (n < 3) return p;

  for (let it = 0; it < iterations; it++) {
    const force: Point[] = p.map(() => ({ x: 0, y: 0, z: 0 }));

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = p[i].x - p[j].x;
        const dy = p[i].y - p[j].y;
        const dz = p[i].z - p[j].z;
        const d2 = dx * dx + dy * dy + dz * dz || 1e-6;
        const f = 1 / d2;
        const d = Math.sqrt(d2);
        force[i].x += (dx / d) * f;
        force[i].y += (dy / d) * f;
        force[i].z += (dz / d) * f;
        force[j].x -= (dx / d) * f;
        force[j].y -= (dy / d) * f;
        force[j].z -= (dz / d) * f;
      }
    }

    // Cool off over the run so it settles instead of oscillating.
    const step = (strength / n) * (1 - it / iterations);
    for (let i = 0; i < n; i++) {
      p[i].x += force[i].x * step;
      p[i].y += force[i].y * step;
      p[i].z += force[i].z * step;
      const L = Math.hypot(p[i].x, p[i].y, p[i].z) || 1;
      p[i].x /= L;
      p[i].y /= L;
      p[i].z /= L;
    }
  }
  return p;
}

/** Unit sphere, evenly spread. Radius is applied by the caller. */
export function sphereLayout(n: number): Point[] {
  return relax(fibonacciSphere(n));
}

/* ------------------------------------------------------------------ spiral */

/**
 * Measured on k95.it: a clean helix. Consecutive images sat exactly 0.5833
 * apart vertically and 30.0 degrees apart, on a cylinder of radius ~5.53.
 * 360 / 30 = 12 images per turn; 12 x 0.5833 = 7.0 of rise per turn.
 */
export const SPIRAL = {
  /** Images per full revolution. */
  perTurn: 12,
  /** Rise per revolution / radius — 7.0 / 5.53. */
  pitchPerRadius: 1.266,
} as const;

/**
 * Whole turns the thread makes before it closes.
 *
 * The helix wraps — an image that climbs off the top comes back at the bottom —
 * and for the thread to actually join up there, n images have to close a whole
 * number of turns. The measured 12-per-turn only does that when n is a multiple
 * of 12: at n = 30 you get 2.5 turns, the seam lands half a turn out of phase,
 * and the spiral visibly breaks into two separate bands.
 *
 * So the angular step bends to the nearest whole number of turns instead. The
 * measured pitch per *turn* is preserved exactly either way; only the images
 * per turn shift, and not at all when n is a multiple of 12.
 */
export function spiralTurns(n: number) {
  return Math.max(1, Math.round(n / SPIRAL.perTurn));
}

/** Radians between consecutive images, snapped so the thread closes. */
export function spiralStep(n: number) {
  return (Math.PI * 2 * spiralTurns(n)) / n;
}

/** Rise between consecutive images, keeping pitch-per-turn at the measured value. */
export function spiralRise(n: number) {
  return (SPIRAL.pitchPerRadius * spiralTurns(n)) / n;
}

/**
 * Unit helix: radius 1, rising `pitchPerRadius` per turn, centred on y = 0.
 *
 * `offset` slides the whole thread along its own axis in image-steps — the
 * screw motion the wheel drives.
 */
export function spiralLayout(
  n: number,
  offset = 0,
  axis: Axis = "vertical",
): Point[] {
  const step = spiralStep(n);
  const rise = spiralRise(n);
  return Array.from({ length: n }, (_, i) => {
    const k = (((i + offset) % n) + n) % n - n / 2;
    // Angle follows the *unwrapped* index so the thread stays continuous
    // across the seam instead of snapping to a new phase.
    const a = (i + offset) * step;
    return onAxis({ x: Math.cos(a), y: k * rise, z: Math.sin(a) }, axis);
  });
}

/** Half-height of the helix — how far an image gets before it wraps. */
export function spiralReach(n: number) {
  return (n / 2) * spiralRise(n);
}

/* -------------------------------------------------------------------- misc */

export const MODES = ["sphere", "spiral"] as const;
export type Mode = (typeof MODES)[number];

/** Whether this arrangement has an axis to orient at all. */
export function hasAxis(mode: Mode) {
  return mode !== "sphere";
}

/** Nearest-neighbour coefficient of variation — how evenly spread a set is. */
export function neighbourCV(points: Point[]) {
  const d = points.map((p, i) => {
    let best = Infinity;
    points.forEach((q, j) => {
      if (i === j) return;
      const v = Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
      if (v < best) best = v;
    });
    return best;
  });
  const mean = d.reduce((a, b) => a + b, 0) / d.length;
  const sd = Math.sqrt(d.reduce((s, v) => s + (v - mean) ** 2, 0) / d.length);
  return sd / mean;
}
