/**
 * Measured constants and the blob config contract.
 *
 * Every number marked `measured` was read off the live vanlent.dev page by
 * hooking `gl.drawArrays` on the shared WebGL2 context and dumping the active
 * uniforms per draw call. Nothing here is eyeballed.
 */

/** Wobble kinds, with the IDs the original dispatches on. */
export const WOBBLE = {
  ORGANIC: 0,
  SPIKY: 1,
  SHATTER: 2,
  SPIKE_BURST: 3,
  CORONA: 4,
  CUBE_LATTICE: 8,
  NEBULA: 9,
} as const

export type WobbleName = keyof typeof WOBBLE
export type WobbleId = (typeof WOBBLE)[WobbleName]

/**
 * measured: the original's `getWobbleSingle` branches on these exact
 * thresholds, and returns 0.0 for IDs 5-7 with the comment
 * "reserved IDs 5-7 (removed wobble types)". We keep the numbering so a
 * config written against one implementation reads the same in the other.
 */
export const WOBBLE_NAMES = Object.keys(WOBBLE) as WobbleName[]

export const WOBBLE_LABELS: Record<WobbleName, string> = {
  ORGANIC: 'Organic',
  SPIKY: 'Spiky',
  SHATTER: 'Shatter',
  SPIKE_BURST: 'Spike burst',
  CORONA: 'Corona',
  CUBE_LATTICE: 'Cube lattice',
  NEBULA: 'Nebula',
}

/**
 * measured: across a blob's layer stack the displacement amplitude falls off
 * geometrically and the shell lock rises geometrically toward 1.
 *
 *   noiseAmount : 0.29882 -> 0.23905 -> 0.19124   ratios 0.800000, 0.800000
 *   1-lockShell : 0.45063 -> 0.38303 -> 0.32558   ratios 0.850000, 0.850000
 *
 * Read to six decimal places on three consecutive draws of the same blob, and
 * again on a second blob elsewhere on the page. They are 0.8 and 0.85 exactly.
 */
export const LAYER_NOISE_FALLOFF = 0.8
export const LAYER_LOCK_FALLOFF = 0.85

/** measured: the original draws 3 stacked layers for a standard blob. */
export const DEFAULT_LAYERS = 3

/** measured: 30000 points per layer, all layers sharing one buffer. */
export const DEFAULT_COUNT = 30000

export type MouseMode = 'none' | 'repel' | 'attract'

export interface BlobConfig {
  /** Points per layer. measured: 30000 on the original. */
  count: number
  /** Stacked shells. measured: 3. */
  layers: number

  /** Wobble to blend from. */
  wobbleFrom: WobbleId
  /** Wobble to blend to. */
  wobbleTo: WobbleId
  /** 0 = fully `wobbleFrom`, 1 = fully `wobbleTo`. */
  wobbleBlend: number

  /**
   * Radial displacement amplitude on the outermost layer.
   * measured range on the original: 0.12 - 1.0
   */
  noiseAmount: number
  /**
   * How hard the outermost layer is pinned to the unit shell.
   * measured range on the original: 0.168 - 0.674
   */
  lockShell: number

  /** Tangential curl advection. measured: 0.78 on the hero's flow layer. */
  curlAmount: number
  /** Curl noise frequency. measured: 0.36 on that layer, 0.05 elsewhere. */
  curlFrequency: number

  /** Animation rate. measured: 1. */
  timeScale: number
  /** Overall scale. measured: 0.994 - 1.148. */
  scale: number

  /** Point size in pixels at unit distance. */
  pointSize: number
  /** Particle colour, `#rrggbb`. */
  color: string
  /** Page/background colour behind the blob, `#rrggbb`. */
  background: string
  /** Fresnel rim brightening on the particle cloud. */
  rimIntensity: number
  /** 0 = hard square points, 1 = soft round sprites. */
  softSprites: number
  /** Base particle opacity. */
  opacity: number

  /** Cursor push/pull. measured mode set: none / repel / attract. */
  mouseMode: MouseMode
  /** measured: 0.2 */
  mouseIntensity: number
  /** measured: 1.2 */
  mouseRadius: number

  /** Drag to orbit, with inertia. */
  dragToOrbit: boolean
  /** Click anywhere to crossfade wobbleBlend between from/to. */
  clickToMorph: boolean
  /** Idle spin, radians per second. */
  autoSpin: number

  /** Frosted-glass shell rendered over the cloud. */
  glass: boolean
  /** Glass shell radius relative to the unit sphere. */
  glassRadius: number
  /** Index-of-refraction-ish bend applied to the sampled cloud. */
  glassRefraction: number
  /** Frost blur strength, in screen pixels at the widest. */
  glassFrost: number
  /** Chromatic split at the glass edge, in screen pixels. */
  glassDispersion: number
  /** Edge Fresnel brightness. */
  glassRim: number
  /** Specular highlight strength. */
  glassSpecular: number
  /** Glass body tint, `#rrggbb`. */
  glassTint: string
  /** How much tint to mix in. */
  glassTintMix: number
}

export const DEFAULT_CONFIG: BlobConfig = {
  count: DEFAULT_COUNT,
  layers: DEFAULT_LAYERS,
  wobbleFrom: WOBBLE.ORGANIC,
  wobbleTo: WOBBLE.ORGANIC,
  wobbleBlend: 0,
  noiseAmount: 0.3,
  lockShell: 0.25,
  curlAmount: 0,
  curlFrequency: 0.05,
  timeScale: 1,
  scale: 1,
  pointSize: 1.0,
  color: '#1a1a1a',
  background: '#f7f7f8',
  rimIntensity: 0,
  softSprites: 0,
  opacity: 0.35,
  mouseMode: 'repel',
  mouseIntensity: 0.2,
  mouseRadius: 1.2,
  dragToOrbit: true,
  clickToMorph: false,
  autoSpin: 0.08,
  glass: false,
  glassRadius: 0.82,
  glassRefraction: 0.35,
  glassFrost: 8,
  glassDispersion: 3,
  glassRim: 0.6,
  glassSpecular: 0.5,
  glassTint: '#cfe4ff',
  glassTintMix: 0.18,
}
