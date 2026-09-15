import {
  LAYER_LOCK_FALLOFF,
  LAYER_NOISE_FALLOFF,
  type BlobConfig,
  type MouseMode,
} from './config'
import { hexToRgb, layerParams, perPointRandom, sphereSurface } from './geometry'
import {
  BLUR_FRAG,
  GLASS_FRAG,
  POINTS_FRAG,
  POINTS_VERT,
  QUAD_VERT,
} from './shaders'

/* ------------------------------------------------------------------ maths */

type Mat4 = Float32Array

function perspective(fovY: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovY / 2)
  const nf = 1 / (near - far)
  // prettier-ignore
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ])
}

function lookAtZ(distance: number): Mat4 {
  // Camera on +Z looking at the origin; no roll, so this is just a translate.
  // prettier-ignore
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, -distance, 1,
  ])
}

function rotationYX(yaw: number, pitch: number): Mat4 {
  const cy = Math.cos(yaw), sy = Math.sin(yaw)
  const cx = Math.cos(pitch), sx = Math.sin(pitch)
  // Ry then Rx, column-major.
  // prettier-ignore
  return new Float32Array([
    cy,       0,   -sy,      0,
    sy * sx,  cx,  cy * sx,  0,
    sy * cx, -sx,  cy * cx,  0,
    0,        0,   0,        1,
  ])
}

const MOUSE_SIGN: Record<MouseMode, number> = { none: 0, repel: 1, attract: -1 }

/* -------------------------------------------------------------- gl helpers */

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh)
    gl.deleteShader(sh)
    throw new Error(`shader compile failed:\n${log}`)
  }
  return sh
}

function link(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram()!
  const v = compile(gl, gl.VERTEX_SHADER, vs)
  const f = compile(gl, gl.FRAGMENT_SHADER, fs)
  gl.attachShader(p, v)
  gl.attachShader(p, f)
  gl.linkProgram(p)
  gl.deleteShader(v)
  gl.deleteShader(f)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(p)
    gl.deleteProgram(p)
    throw new Error(`program link failed:\n${log}`)
  }
  return p
}

function uniformMap(gl: WebGL2RenderingContext, p: WebGLProgram) {
  const map: Record<string, WebGLUniformLocation | null> = {}
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i)
    if (info) map[info.name] = gl.getUniformLocation(p, info.name)
  }
  return map
}

interface Target {
  fbo: WebGLFramebuffer
  tex: WebGLTexture
  width: number
  height: number
}

function makeTarget(gl: WebGL2RenderingContext, w: number, h: number): Target {
  const tex = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  const fbo = gl.createFramebuffer()!
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  return { fbo, tex, width: w, height: h }
}

/* ----------------------------------------------------------------- camera */

const FOV = (45 * Math.PI) / 180
const CAM_DISTANCE = 4.2

/* --------------------------------------------------------------- renderer */

export interface BlobRenderer {
  /** Advance and draw one frame. `dt` in seconds. */
  frame(dt: number): void
  /** Swap in a new config. Rebuilds buffers only when `count` changed. */
  setConfig(config: BlobConfig): void
  /** Pointer position in CSS pixels relative to the canvas, or null. */
  setPointer(x: number | null, y: number | null): void
  /** Add to the orbit, in radians. */
  addOrbit(dYaw: number, dPitch: number): void
  /** Flip the wobble crossfade between its two ends. */
  toggleMorph(): void
  /** Resize to the canvas' current CSS box. */
  resize(): void
  dispose(): void
}

export function createBlobRenderer(
  canvas: HTMLCanvasElement,
  initial: BlobConfig,
): BlobRenderer {
  const context = canvas.getContext('webgl2', {
    antialias: true,
    alpha: false,
    premultipliedAlpha: false,
  })
  if (!context) throw new Error('WebGL2 is required')
  const gl = context

  let config = initial

  const pointsProgram = link(gl, POINTS_VERT, POINTS_FRAG)
  const blurProgram = link(gl, QUAD_VERT, BLUR_FRAG)
  const glassProgram = link(gl, QUAD_VERT, GLASS_FRAG)
  const uPoints = uniformMap(gl, pointsProgram)
  const uBlur = uniformMap(gl, blurProgram)
  const uGlass = uniformMap(gl, glassProgram)

  const aPosition = gl.getAttribLocation(pointsProgram, 'aPosition')
  const aRand = gl.getAttribLocation(pointsProgram, 'aRand')

  // One geometry, shared by every layer.
  // measured: the original does exactly this — all four of its layer draws
  // read the same buffer, byte for byte. Only the uniforms differ.
  let vao = gl.createVertexArray()!
  let posBuffer = gl.createBuffer()!
  let randBuffer = gl.createBuffer()!
  let pointCount = 0

  function buildGeometry(count: number) {
    pointCount = count
    gl.bindVertexArray(vao)

    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, sphereSurface(count), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(aPosition)
    gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0)

    gl.bindBuffer(gl.ARRAY_BUFFER, randBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, perPointRandom(count), gl.STATIC_DRAW)
    if (aRand >= 0) {
      gl.enableVertexAttribArray(aRand)
      gl.vertexAttribPointer(aRand, 1, gl.FLOAT, false, 0, 0)
    }

    gl.bindVertexArray(null)
  }
  buildGeometry(config.count)

  // The quad programs draw a fullscreen triangle from gl_VertexID, so they
  // need a bound VAO but no attributes.
  const emptyVao = gl.createVertexArray()!

  let sceneTarget: Target | null = null
  let blurA: Target | null = null
  let blurB: Target | null = null

  let width = 0
  let height = 0
  let dpr = 1

  function releaseTargets() {
    for (const t of [sceneTarget, blurA, blurB]) {
      if (!t) continue
      gl.deleteFramebuffer(t.fbo)
      gl.deleteTexture(t.tex)
    }
    sceneTarget = blurA = blurB = null
  }

  function resize() {
    const rect = canvas.getBoundingClientRect()
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = Math.max(1, Math.round(rect.width * dpr))
    const h = Math.max(1, Math.round(rect.height * dpr))
    if (w === width && h === height) return
    width = w
    height = h
    canvas.width = w
    canvas.height = h
    releaseTargets()
    sceneTarget = makeTarget(gl, w, h)
    // Half-resolution blur chain: cheaper, and a blur is low-frequency anyway.
    const bw = Math.max(1, w >> 1)
    const bh = Math.max(1, h >> 1)
    blurA = makeTarget(gl, bw, bh)
    blurB = makeTarget(gl, bw, bh)
  }
  resize()

  /* ------------------------------------------------------------- state */

  let time = 0
  let yaw = 0
  let pitch = 0
  let yawVel = 0
  let pitchVel = 0

  // Pointer in world space on the sphere's plane, and a smoothed copy so the
  // cloud does not snap when the cursor jumps.
  let pointerTarget: [number, number, number] | null = null
  const pointer: [number, number, number] = [0, 0, 0]
  let pointerStrength = 0

  // Click-to-morph rides on top of `config.wobbleBlend`. It stays inactive
  // until clicked, and steps aside again the moment the config's own blend
  // changes underneath it (someone dragged the slider).
  let morphTarget: number | null = null
  let morphValue = 0
  let lastConfigBlend = config.wobbleBlend

  function toggleMorph() {
    const current = morphTarget === null ? config.wobbleBlend : morphValue
    morphTarget = current > 0.5 ? 0 : 1
    if (morphValue === 0 && current !== 0) morphValue = current
  }

  function setPointer(x: number | null, y: number | null) {
    if (x === null || y === null) {
      pointerTarget = null
      return
    }
    const rect = canvas.getBoundingClientRect()
    // NDC -> a point on the z=0 plane in view space, at the camera distance.
    const ndcX = (x / rect.width) * 2 - 1
    const ndcY = -((y / rect.height) * 2 - 1)
    const aspect = rect.width / Math.max(rect.height, 1)
    const halfH = Math.tan(FOV / 2) * CAM_DISTANCE
    pointerTarget = [ndcX * halfH * aspect, ndcY * halfH, 0]
  }

  function addOrbit(dYaw: number, dPitch: number) {
    yawVel += dYaw
    pitchVel += dPitch
  }

  function setConfig(next: BlobConfig) {
    if (next.count !== pointCount) buildGeometry(next.count)
    config = next
  }

  /* -------------------------------------------------------------- draw */

  function drawPoints(target: Target | null) {
    const g = gl
    g.bindFramebuffer(g.FRAMEBUFFER, target ? target.fbo : null)
    g.viewport(0, 0, target ? target.width : width, target ? target.height : height)

    const bg = hexToRgb(config.background)
    g.clearColor(bg[0], bg[1], bg[2], 1)
    g.clear(g.COLOR_BUFFER_BIT)

    g.enable(g.BLEND)
    g.blendFunc(g.SRC_ALPHA, g.ONE_MINUS_SRC_ALPHA)
    g.disable(g.DEPTH_TEST)

    g.useProgram(pointsProgram)
    g.bindVertexArray(vao)

    const aspect = width / Math.max(height, 1)
    g.uniformMatrix4fv(uPoints.uProjection!, false, perspective(FOV, aspect, 0.1, 100))
    g.uniformMatrix4fv(uPoints.uView!, false, lookAtZ(CAM_DISTANCE))
    g.uniformMatrix4fv(uPoints.uModel!, false, rotationYX(yaw, pitch))

    const color = hexToRgb(config.color)
    g.uniform1f(uPoints.uTime!, time)
    g.uniform1f(uPoints.uTimeScale!, config.timeScale)
    g.uniform1f(uPoints.uCurlAmount!, config.curlAmount)
    g.uniform1f(uPoints.uCurlFrequency!, config.curlFrequency)
    g.uniform1f(uPoints.uWobbleFrom!, config.wobbleFrom)
    g.uniform1f(uPoints.uWobbleTo!, config.wobbleTo)
    g.uniform1f(
      uPoints.uWobbleBlend!,
      morphTarget === null ? config.wobbleBlend : morphValue,
    )
    g.uniform1f(uPoints.uScale!, config.scale)
    g.uniform1f(uPoints.uPointSize!, config.pointSize)
    g.uniform1f(uPoints.uPixelRatio!, dpr)
    g.uniform1f(uPoints.uCamDistance!, CAM_DISTANCE)
    g.uniform3f(uPoints.uColor!, color[0], color[1], color[2])
    g.uniform1f(uPoints.uSoftSprites!, config.softSprites)
    g.uniform1f(uPoints.uRimIntensity!, config.rimIntensity)

    g.uniform3f(uPoints.uMouse!, pointer[0], pointer[1], pointer[2])
    g.uniform1f(
      uPoints.uMouseMode!,
      MOUSE_SIGN[config.mouseMode] * pointerStrength,
    )
    g.uniform1f(uPoints.uMouseIntensity!, config.mouseIntensity)
    g.uniform1f(uPoints.uMouseRadius!, config.mouseRadius)

    // measured: noise falls off by 0.8 per layer, and the gap to a fully
    // locked shell falls off by 0.85. Both exact to six decimal places.
    for (let i = 0; i < config.layers; i++) {
      const { noiseAmount, lockShell } = layerParams(
        i,
        config.noiseAmount,
        config.lockShell,
        LAYER_NOISE_FALLOFF,
        LAYER_LOCK_FALLOFF,
      )
      g.uniform1f(uPoints.uNoiseAmount!, noiseAmount)
      g.uniform1f(uPoints.uLockShell!, lockShell)
      g.uniform1f(uPoints.uOpacity!, config.opacity / Math.sqrt(config.layers))
      g.drawArrays(g.POINTS, 0, pointCount)
    }

    g.bindVertexArray(null)
  }

  function blurPass(from: Target, to: Target, dx: number, dy: number) {
    const g = gl
    g.bindFramebuffer(g.FRAMEBUFFER, to.fbo)
    g.viewport(0, 0, to.width, to.height)
    g.useProgram(blurProgram)
    g.bindVertexArray(emptyVao)
    g.disable(g.BLEND)
    g.activeTexture(g.TEXTURE0)
    g.bindTexture(g.TEXTURE_2D, from.tex)
    g.uniform1i(uBlur.uTex!, 0)
    g.uniform2f(uBlur.uDirection!, dx / to.width, dy / to.height)
    g.drawArrays(g.TRIANGLES, 0, 3)
    g.bindVertexArray(null)
  }

  function drawGlass() {
    const g = gl
    g.bindFramebuffer(g.FRAMEBUFFER, null)
    g.viewport(0, 0, width, height)
    g.useProgram(glassProgram)
    g.bindVertexArray(emptyVao)
    g.disable(g.BLEND)

    g.activeTexture(g.TEXTURE0)
    g.bindTexture(g.TEXTURE_2D, sceneTarget!.tex)
    g.uniform1i(uGlass.uScene!, 0)
    g.activeTexture(g.TEXTURE1)
    g.bindTexture(g.TEXTURE_2D, blurB!.tex)
    g.uniform1i(uGlass.uBlur!, 1)

    // The glass sphere is centred on the blob and sized by projecting its
    // radius at the camera distance, so it tracks `scale` for free.
    const halfH = Math.tan(FOV / 2) * CAM_DISTANCE
    const radiusPx = (config.glassRadius * config.scale / halfH) * (height / 2)

    const tint = hexToRgb(config.glassTint)
    g.uniform2f(uGlass.uResolution!, width, height)
    g.uniform2f(uGlass.uCenter!, width / 2, height / 2)
    g.uniform1f(uGlass.uRadius!, radiusPx)
    g.uniform1f(uGlass.uRefraction!, config.glassRefraction * 0.15)
    g.uniform1f(uGlass.uDispersion!, config.glassDispersion * dpr)
    g.uniform1f(uGlass.uFrost!, Math.min(config.glassFrost / 16, 1))
    g.uniform1f(uGlass.uRim!, config.glassRim * 0.25)
    g.uniform1f(uGlass.uSpecular!, config.glassSpecular)
    g.uniform3f(uGlass.uTint!, tint[0], tint[1], tint[2])
    g.uniform1f(uGlass.uTintMix!, config.glassTintMix)

    g.drawArrays(g.TRIANGLES, 0, 3)
    g.bindVertexArray(null)
  }

  /* -------------------------------------------------------------- loop */

  function frame(dt: number) {
    const step = Math.min(dt, 1 / 20)
    time += step

    // Frame-rate independent easing, never a fixed per-frame lerp.
    const ease = (per60: number) => 1 - Math.pow(1 - per60, step / (1 / 60))

    // Orbit inertia.
    yaw += yawVel
    pitch += pitchVel
    pitch = Math.max(-1.2, Math.min(1.2, pitch))
    const damp = 1 - ease(0.12)
    yawVel *= damp
    pitchVel *= damp
    yaw += config.autoSpin * step

    // A config-driven blend change wins over an in-flight morph.
    if (config.wobbleBlend !== lastConfigBlend) {
      lastConfigBlend = config.wobbleBlend
      morphTarget = null
    }
    if (morphTarget !== null) {
      morphValue += (morphTarget - morphValue) * ease(0.06)
    }

    // Pointer follow + strength fade, so losing the cursor releases smoothly.
    const k = ease(0.2)
    if (pointerTarget) {
      pointer[0] += (pointerTarget[0] - pointer[0]) * k
      pointer[1] += (pointerTarget[1] - pointer[1]) * k
      pointer[2] += (pointerTarget[2] - pointer[2]) * k
      pointerStrength += (1 - pointerStrength) * k
    } else {
      pointerStrength += (0 - pointerStrength) * k
    }

    if (config.glass) {
      drawPoints(sceneTarget)
      const px = Math.max(config.glassFrost, 0.5)
      blurPass(sceneTarget!, blurA!, px, 0)
      blurPass(blurA!, blurB!, 0, px)
      drawGlass()
    } else {
      drawPoints(null)
    }
  }

  function dispose() {
    const g = gl
    releaseTargets()
    g.deleteBuffer(posBuffer)
    g.deleteBuffer(randBuffer)
    g.deleteVertexArray(vao)
    g.deleteVertexArray(emptyVao)
    g.deleteProgram(pointsProgram)
    g.deleteProgram(blurProgram)
    g.deleteProgram(glassProgram)
  }

  return { frame, setConfig, setPointer, addOrbit, toggleMorph, resize, dispose }
}
