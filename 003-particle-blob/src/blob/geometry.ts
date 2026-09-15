/**
 * Point distribution on the unit sphere. Pure — no React, no GL.
 *
 * measured: the original's position buffer holds points at radius exactly
 * 1.0000, with `y` uniform over [-1, 1]. Sampled quartiles over 2000 points
 * came back -0.9995 / -0.5016 / -0.0023 / 0.5298 / 0.9989, and consecutive
 * azimuths showed no golden-angle structure (deltas 1.54, 3.70, 4.12, 4.01,
 * 5.90 rad against a golden angle of 2.39996).
 *
 * That is equal-area random sampling, not a Fibonacci lattice: pick `y`
 * uniformly, then a uniform azimuth, and the ring radius follows.
 */

/** A small deterministic PRNG so a given seed always gives the same cloud. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * `count` points uniformly distributed over the surface of the unit sphere.
 * Returns xyz triples, so `length === count * 3`.
 */
export function sphereSurface(count: number, seed = 1): Float32Array {
  const rand = mulberry32(seed)
  const out = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const y = 1 - 2 * rand()
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const phi = rand() * Math.PI * 2
    out[i * 3] = r * Math.cos(phi)
    out[i * 3 + 1] = y
    out[i * 3 + 2] = r * Math.sin(phi)
  }
  return out
}

/**
 * One extra random value per point, used by the wobbles that need per-particle
 * variation (spike burst picks its spikes from this) and by the sprite shader
 * for size jitter.
 */
export function perPointRandom(count: number, seed = 2): Float32Array {
  const rand = mulberry32(seed)
  const out = new Float32Array(count)
  for (let i = 0; i < count; i++) out[i] = rand()
  return out
}

/**
 * measured: layer i of a blob uses `noise0 * 0.8^i` and pins to the shell by
 * `1 - (1 - lock0) * 0.85^i`. Outer layers move most and are least locked.
 */
export function layerParams(
  layerIndex: number,
  noise0: number,
  lock0: number,
  noiseFalloff: number,
  lockFalloff: number,
): { noiseAmount: number; lockShell: number } {
  return {
    noiseAmount: noise0 * Math.pow(noiseFalloff, layerIndex),
    lockShell: 1 - (1 - lock0) * Math.pow(lockFalloff, layerIndex),
  }
}

/** `#rrggbb` -> linear-ish 0..1 triple for a uniform. */
export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex.trim())
  if (!m) return [0, 0, 0]
  return [
    parseInt(m[1], 16) / 255,
    parseInt(m[2], 16) / 255,
    parseInt(m[3], 16) / 255,
  ]
}
