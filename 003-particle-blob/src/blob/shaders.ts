import { NOISE_GLSL } from './noise.glsl'

/**
 * The seven wobbles.
 *
 * `wobbleOrganic` is the original's formula verbatim — it is a one-line
 * reading of a 4D simplex field and there is no other sensible way to write
 * it. The other six are our own implementations of the behaviour each name
 * describes; the original's bodies were not readable, only their names,
 * their dispatch thresholds and their effect on screen.
 */
const WOBBLE_GLSL = /* glsl */ `
// Type 0: ORGANIC — smooth simplex breathing.
float wobbleOrganic(vec3 p, float t) {
  return snoise4(vec4(p / 1.5, t));
}

// Type 1: SPIKY — sharp crystalline protrusions.
// Sharpening a smooth field with a high power leaves isolated points.
float wobbleSpiky(vec3 p, float t) {
  float n = snoise3(p * 2.2 + t * 0.4);
  return sign(n) * pow(abs(n), 4.0) * 2.4;
}

// Type 2: SHATTER — broken glass, angular fragments.
// Quantising the field into steps gives flat plates; a high-frequency term
// roughens the joins so they read as fracture lines rather than terracing.
float wobbleShatter(vec3 p, float t) {
  float n = snoise3(p * 1.6 + t * 0.25);
  float plates = floor(n * 5.0) / 5.0;
  float edge = snoise3(p * 6.0 - t * 0.2);
  return plates + edge * 0.12;
}

// Type 3: SPIKE_BURST — random spikes erupting from the surface.
// A smooth cell field decides *where* spikes grow; the per-particle random
// decides which individual points ride each one out, so a spike has a frayed
// tip instead of a clean cone.
float wobbleSpikeBurst(vec3 p, float t, float rnd) {
  float cell = snoise3(p * 3.0);
  float pulse = 0.5 + 0.5 * sin(t * 1.6 + cell * 12.0 + rnd * 6.283);
  float mask = smoothstep(0.55, 0.95, cell + rnd * 0.12);
  return mask * pulse * 3.0 - 0.06;
}

// Type 4: CORONA — solar-flare spikes radiating.
// Angular bands in latitude and longitude, rectified so flares only push out.
float wobbleCorona(vec3 p, float t) {
  float lat = acos(clamp(p.y, -1.0, 1.0));
  float lon = atan(p.z, p.x);
  float bands = sin(lon * 9.0 + t * 0.8) * sin(lat * 7.0 - t * 0.5);
  float flare = snoise3(p * 1.8 + t * 0.35);
  return pow(max(bands, 0.0), 2.0) * (0.6 + flare) * 1.8;
}

// Type 8: CUBE_LATTICE — the sphere pushed toward a cube.
// The Chebyshev norm is 1 on a cube; dividing by it maps sphere onto cube.
float wobbleCubeLattice(vec3 p, float t) {
  vec3 a = abs(p);
  float cube = max(a.x, max(a.y, a.z));
  float breathe = 0.5 + 0.5 * sin(t * 0.6);
  // 1/cube maps the sphere exactly onto a cube, but the deviation only spans
  // 0 - 0.73, which the global gain flattens into a fuzzy ball. x3 restores it.
  return (1.0 / max(cube, 0.2) - 1.0) * breathe * 3.0;
}

// Type 9: NEBULA — layered fbm, soft and cloudy.
float wobbleNebula(vec3 p, float t) {
  float n = 0.0, amp = 0.5, f = 1.2;
  for (int i = 0; i < 4; i++) {
    n += snoise3(p * f + t * 0.2 * float(i + 1)) * amp;
    amp *= 0.5;
    f *= 2.1;
  }
  return n * 1.4;
}

// measured: the original branches on exactly these thresholds and returns
// 0.0 for IDs 5-7, commented "reserved IDs 5-7 (removed wobble types)".
float getWobbleSingle(vec3 p, float t, float type, float rnd) {
  if (type < 0.5) return wobbleOrganic(p, t);
  else if (type < 1.5) return wobbleSpiky(p, t);
  else if (type < 2.5) return wobbleShatter(p, t);
  else if (type < 3.5) return wobbleSpikeBurst(p, t, rnd);
  else if (type < 4.5) return wobbleCorona(p, t);
  else if (type < 8.5) {
    if (type < 7.5) return 0.0;
    return wobbleCubeLattice(p, t);
  }
  return wobbleNebula(p, t);
}

float getWobbleBlended(vec3 p, float t, float a, float b, float blend, float rnd) {
  if (blend <= 0.001) return getWobbleSingle(p, t, a, rnd);
  if (blend >= 0.999) return getWobbleSingle(p, t, b, rnd);
  return mix(getWobbleSingle(p, t, a, rnd), getWobbleSingle(p, t, b, rnd), blend);
}
`

export const POINTS_VERT = /* glsl */ `#version 300 es
precision highp float;

in vec3 aPosition;
in float aRand;

uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;

uniform float uTime;
uniform float uTimeScale;
uniform float uNoiseAmount;
uniform float uLockShell;
uniform float uCurlAmount;
uniform float uCurlFrequency;
uniform float uWobbleFrom;
uniform float uWobbleTo;
uniform float uWobbleBlend;
uniform float uScale;
uniform float uPointSize;
uniform float uPixelRatio;
uniform float uCamDistance;

uniform vec3  uMouse;
uniform float uMouseMode;      // 0 none, +1 repel, -1 attract
uniform float uMouseIntensity;
uniform float uMouseRadius;

out float vRim;
out float vFade;

${NOISE_GLSL}
${WOBBLE_GLSL}

void main() {
  vec3 base = normalize(aPosition);
  float t = uTime * uTimeScale;

  // 1. Radial displacement from the blended wobble field.
  //
  // WOBBLE_GAIN is ours, not measured. The original's uNoiseAmount runs over
  // roughly 0.12 - 1.0, but how it scales into actual displacement was not
  // readable, and taking it as a straight fraction of the radius blows the
  // cloud into radial streaks an order of magnitude longer than the real one.
  // 0.3 is the value at which a measured 0.161 reproduces the hero's gentle
  // lumpy circle, and 1.0 still gives the dramatic shapes room to move.
  const float WOBBLE_GAIN = 0.3;
  float w = getWobbleBlended(base, t, uWobbleFrom, uWobbleTo, uWobbleBlend, aRand);
  vec3 pos = base * (1.0 + w * uNoiseAmount * WOBBLE_GAIN);

  // 2. Tangential curl advection, integrated over several steps.
  //
  //    One step does nothing useful: curl noise is divergence-free by
  //    construction, so advecting a uniform cloud along it moves every particle
  //    and bunches none of them. Integrating the flow instead — re-sampling the
  //    field at each new position — is what folds the distribution into the
  //    fingerprint ridges. Four steps is where the pattern reads without the
  //    cost showing.
  if (uCurlAmount > 0.001) {
    float freq = uCurlFrequency * 10.0;
    float stepSize = uCurlAmount * 0.09;
    vec3 q = base;
    for (int i = 0; i < 4; i++) {
      vec3 c = curlNoise(q * freq + vec3(0.0, t * 0.15, 0.0));
      vec3 tang = c - q * dot(c, q);
      q = normalize(q + tang * stepSize);
    }
    // Carry the rearrangement over to the displaced position.
    pos = q * length(pos);
  }

  // 3. Pull back onto the unit shell. At 1.0 the relief is gone but the
  //    tangential rearrangement survives — that is the surface-flow look.
  pos = mix(pos, normalize(pos), uLockShell);

  // 4. Cursor push/pull.
  if (abs(uMouseMode) > 0.5) {
    vec3 d = pos - uMouse;
    float dist = length(d);
    float falloff = 1.0 - smoothstep(0.0, uMouseRadius, dist);
    pos += normalize(d + vec3(1e-5)) * falloff * uMouseIntensity * uMouseMode;
  }

  pos *= uScale;

  vec4 world = uModel * vec4(pos, 1.0);
  vec4 mv = uView * world;

  // Rim and depth fade, both from the particle's outward normal in view space.
  // nv.z near +/-1 means the particle faces the camera; near 0 puts it on the
  // silhouette, which is where a rim light shows.
  vec3 nv = normalize((uView * uModel * vec4(base, 0.0)).xyz);
  vRim = clamp(1.0 - abs(nv.z), 0.0, 1.0);
  vFade = 0.65 + 0.35 * (0.5 + 0.5 * nv.z);

  gl_Position = uProjection * mv;
  // uPointSize is in CSS pixels at the blob's centre; the ratio to the camera
  // distance attenuates it with depth without changing that nominal size.
  gl_PointSize = uPointSize * uPixelRatio * (uCamDistance / max(-mv.z, 0.1));
}
`

export const POINTS_FRAG = /* glsl */ `#version 300 es
precision highp float;

in float vRim;
in float vFade;

uniform vec3  uColor;
uniform float uOpacity;
uniform float uSoftSprites;
uniform float uRimIntensity;

out vec4 fragColor;

void main() {
  vec2 pc = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(pc, pc);
  float hard = 1.0 - step(1.0, r2);
  float soft = 1.0 - smoothstep(0.0, 1.0, r2);
  float a = mix(hard, soft, uSoftSprites);
  if (a <= 0.003) discard;

  vec3 col = uColor + vRim * uRimIntensity;
  fragColor = vec4(col, a * uOpacity * vFade);
}
`

/** Fullscreen triangle, used by both the blur and the glass composite. */
export const QUAD_VERT = /* glsl */ `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`

/** Separable gaussian, 9 taps. Run once horizontally, once vertically. */
export const BLUR_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uDirection;   // texel-space step
out vec4 fragColor;
void main() {
  float w[5];
  w[0] = 0.2270270270;
  w[1] = 0.1945945946;
  w[2] = 0.1216216216;
  w[3] = 0.0540540541;
  w[4] = 0.0162162162;
  vec4 sum = texture(uTex, vUv) * w[0];
  for (int i = 1; i < 5; i++) {
    vec2 o = uDirection * float(i);
    sum += texture(uTex, vUv + o) * w[i];
    sum += texture(uTex, vUv - o) * w[i];
  }
  fragColor = sum;
}
`

/**
 * The glass shell.
 *
 * Ours, not the original's — vanlent.dev has no glass pass. A sphere normal is
 * reconstructed per pixel, the scene behind is sampled through it with an
 * offset that grows toward the rim (refraction), the three channels are split
 * along that normal (dispersion), and a blurred copy is mixed in for frost.
 * Fresnel edge and a specular cap finish it.
 */
export const GLASS_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;

uniform sampler2D uScene;
uniform sampler2D uBlur;
uniform vec2  uResolution;
uniform vec2  uCenter;       // screen px
uniform float uRadius;       // screen px
uniform float uRefraction;
uniform float uDispersion;   // px
uniform float uFrost;        // 0..1 mix toward the blurred copy
uniform float uRim;
uniform float uSpecular;
uniform vec3  uTint;
uniform float uTintMix;

out vec4 fragColor;

void main() {
  vec2 frag = vUv * uResolution;
  vec2 d = (frag - uCenter) / uRadius;
  float r2 = dot(d, d);

  if (r2 > 1.0) {
    fragColor = texture(uScene, vUv);
    return;
  }

  float z = sqrt(max(1.0 - r2, 0.0));
  vec3 n = vec3(d, z);

  // Bend the lookup outward, hardest at the rim where the surface is steepest.
  vec2 off = -n.xy * (1.0 - z) * uRefraction;
  vec2 ruv = vUv + off;

  // Weight the channel split by the same (1 - z) the refraction uses, so the
  // rainbow lives on the rim where a real lens disperses, instead of fringing
  // every particle across the whole disc.
  vec2 disp = n.xy * uDispersion * (1.0 - z) / uResolution;

  vec3 col;
  col.r = mix(texture(uScene, ruv + disp).r, texture(uBlur, ruv + disp).r, uFrost);
  col.g = mix(texture(uScene, ruv).g,        texture(uBlur, ruv).g,        uFrost);
  col.b = mix(texture(uScene, ruv - disp).b, texture(uBlur, ruv - disp).b, uFrost);

  col = mix(col, col * uTint + uTint * 0.12, uTintMix);

  // Fresnel: the rim of a glass ball is where you see the most.
  float fres = pow(1.0 - z, 3.0);
  col += fres * uRim;

  vec3 L = normalize(vec3(-0.45, 0.65, 0.62));
  float spec = pow(max(dot(n, L), 0.0), 30.0);
  col += spec * uSpecular;

  // A thin bright contact line right on the silhouette.
  float edge = smoothstep(0.97, 1.0, r2) * (1.0 - smoothstep(1.0, 1.001, r2));
  col += edge * uRim * 0.8;

  fragColor = vec4(col, 1.0);
}
`
