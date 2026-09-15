import { DEFAULT_CONFIG, WOBBLE, type BlobConfig } from './config'

export interface Preset {
  name: string
  note: string
  config: BlobConfig
}

const from = (note: string, name: string, over: Partial<BlobConfig>): Preset => ({
  name,
  note,
  config: { ...DEFAULT_CONFIG, ...over },
})

/**
 * The first four are uniform rows lifted straight off vanlent.dev — captured by
 * reading `gl.getUniform` for every active uniform at draw time. The rest are
 * ours, built on the same contract.
 */
export const PRESETS: Preset[] = [
  from('measured: hero, outermost layer', 'Hero dust', {
    noiseAmount: 0.161,
    lockShell: 0.168,
    curlAmount: 0.001,
    curlFrequency: 0.05,
    scale: 1.148,
    opacity: 0.32,
  }),
  from('measured: hero flow layer, locked to the shell', 'Surface flow', {
    count: 24000,
    layers: 1,
    curlAmount: 0.78,
    curlFrequency: 0.36,
    lockShell: 1,
    noiseAmount: 0,
    scale: 1.148,
    opacity: 0.45,
  }),
  from('measured: caught mid-morph, blend 0.189', 'Spike burst', {
    wobbleFrom: WOBBLE.ORGANIC,
    wobbleTo: WOBBLE.SPIKE_BURST,
    wobbleBlend: 0.189,
    noiseAmount: 0.193,
    lockShell: 0.51,
  }),
  from('measured: settled state, three layers', 'Settled', {
    noiseAmount: 0.2988,
    lockShell: 0.5494,
  }),
  from('ours: full-amplitude spike burst', 'Sea urchin', {
    wobbleFrom: WOBBLE.SPIKE_BURST,
    wobbleTo: WOBBLE.SPIKE_BURST,
    wobbleBlend: 1,
    noiseAmount: 0.85,
    lockShell: 0.1,
    opacity: 0.45,
  }),
  from('ours: angular fragments', 'Shatter', {
    wobbleFrom: WOBBLE.SHATTER,
    wobbleTo: WOBBLE.SHATTER,
    wobbleBlend: 1,
    noiseAmount: 0.45,
    lockShell: 0.2,
  }),
  from('ours: radiating flares', 'Corona', {
    wobbleFrom: WOBBLE.CORONA,
    wobbleTo: WOBBLE.CORONA,
    wobbleBlend: 1,
    noiseAmount: 0.55,
    lockShell: 0.15,
    timeScale: 0.6,
  }),
  from('ours: boxy lattice', 'Cube lattice', {
    wobbleFrom: WOBBLE.CUBE_LATTICE,
    wobbleTo: WOBBLE.CUBE_LATTICE,
    wobbleBlend: 1,
    noiseAmount: 0.4,
    lockShell: 0.3,
  }),
  // Glass needs contrast behind it. A pale cloud on a pale page refracts to
  // more pale page and the shell disappears, so both glass presets run a dense
  // cloud against a dark ground.
  from('ours: frosted glass shell over a calm cloud', 'Liquid glass', {
    glass: true,
    noiseAmount: 0.22,
    lockShell: 0.45,
    curlAmount: 0.3,
    curlFrequency: 0.5,
    background: '#101422',
    color: '#dce6ff',
    opacity: 0.85,
    pointSize: 2.1,
    glassRadius: 0.84,
    glassRefraction: 0.45,
    glassFrost: 9,
    glassDispersion: 5,
    glassRim: 0.95,
    glassSpecular: 0.85,
    glassTint: '#bcd8ff',
    glassTintMix: 0.3,
  }),
  from('ours: dark room, glowing glass', 'Night glass', {
    glass: true,
    background: '#0c0d10',
    color: '#7fd4ff',
    opacity: 0.8,
    rimIntensity: 0.6,
    softSprites: 1,
    pointSize: 2.4,
    noiseAmount: 0.3,
    lockShell: 0.4,
    curlAmount: 0.4,
    curlFrequency: 0.45,
    glassRadius: 0.8,
    glassRefraction: 0.5,
    glassFrost: 14,
    glassDispersion: 6,
    glassRim: 0.9,
    glassSpecular: 0.8,
    glassTint: '#6ea8ff',
    glassTintMix: 0.25,
  }),
]
