import { useMemo, useState } from 'react'
import './App.css'
import { Blob } from './blob/Blob'
import {
  DEFAULT_CONFIG,
  WOBBLE_LABELS,
  WOBBLE_NAMES,
  WOBBLE,
  type BlobConfig,
  type MouseMode,
  type WobbleId,
} from './blob/config'
import { PRESETS } from './blob/presets'
import { hexToRgb } from './blob/geometry'
import { Color, Group, Select, Slider, Switch } from './studio/Controls'
import { toConfigObject, toJsx } from './studio/exportCode'

const WOBBLE_OPTIONS = WOBBLE_NAMES.map((name) => ({
  value: WOBBLE[name] as WobbleId,
  label: WOBBLE_LABELS[name],
}))

const MOUSE_OPTIONS: { value: MouseMode; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'repel', label: 'Repel' },
  { value: 'attract', label: 'Attract' },
]

/** Relative luminance, so the studio chrome can sit on the blob's own page. */
function isDark(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.5
}

export default function App() {
  const [config, setConfig] = useState<BlobConfig>(PRESETS[0].config)
  const [activePreset, setActivePreset] = useState(PRESETS[0].name)
  const [sheet, setSheet] = useState<'jsx' | 'config' | null>(null)
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)

  const set = <K extends keyof BlobConfig>(key: K, value: BlobConfig[K]) => {
    setConfig((c) => ({ ...c, [key]: value }))
    setActivePreset('')
  }

  const code = useMemo(
    () => (sheet === 'config' ? toConfigObject(config) : toJsx(config)),
    [sheet, config],
  )

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="studio" data-theme={isDark(config.background) ? 'dark' : 'light'}>
      <div className="studio__stage">
        <Blob {...config} />
      </div>

      <div className="studio__title">
        <h1>Particle Blob</h1>
        <p>
          One point cloud, one shader. Every look below is the same 30,000 points with a
          different row of numbers.
        </p>
      </div>

      <div className="studio__hint">
        drag to orbit · cursor {config.mouseMode}
        {config.clickToMorph ? ' · click to morph' : ''}
      </div>

      <div className={`panel${open ? ' panel--open' : ''}`}>
        <button className="panel__toggle" onClick={() => setOpen((o) => !o)}>
          {open ? 'Close controls' : 'Controls'}
        </button>

        <div className="panel__scroll">
          <Group title="Presets">
            <div className="chips">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  className="chip"
                  aria-pressed={activePreset === p.name}
                  title={p.note}
                  onClick={() => {
                    setConfig(p.config)
                    setActivePreset(p.name)
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </Group>

          <Group title="Shape">
            <Select
              label="Wobble from"
              value={config.wobbleFrom}
              options={WOBBLE_OPTIONS}
              onChange={(v) => set('wobbleFrom', v)}
            />
            <Select
              label="Wobble to"
              value={config.wobbleTo}
              options={WOBBLE_OPTIONS}
              onChange={(v) => set('wobbleTo', v)}
            />
            <Slider
              label="Blend"
              value={config.wobbleBlend}
              min={0}
              max={1}
              onChange={(v) => set('wobbleBlend', v)}
            />
            <Slider
              label="Noise amount"
              value={config.noiseAmount}
              min={0}
              max={1}
              onChange={(v) => set('noiseAmount', v)}
            />
            <Slider
              label="Lock to shell"
              value={config.lockShell}
              min={0}
              max={1}
              onChange={(v) => set('lockShell', v)}
            />
            <Slider
              label="Curl amount"
              value={config.curlAmount}
              min={0}
              max={1}
              onChange={(v) => set('curlAmount', v)}
            />
            <Slider
              label="Curl frequency"
              value={config.curlFrequency}
              min={0.01}
              max={1}
              onChange={(v) => set('curlFrequency', v)}
            />
            <Slider
              label="Scale"
              value={config.scale}
              min={0.4}
              max={1.6}
              onChange={(v) => set('scale', v)}
            />
          </Group>

          <Group title="Cloud">
            <Slider
              label="Points"
              value={config.count}
              min={2000}
              max={60000}
              step={1000}
              measured={config.count === 30000}
              onChange={(v) => set('count', v)}
            />
            <Slider
              label="Layers"
              value={config.layers}
              min={1}
              max={6}
              step={1}
              measured={config.layers === 3}
              onChange={(v) => set('layers', v)}
            />
            <Slider
              label="Point size"
              value={config.pointSize}
              min={0.5}
              max={6}
              step={0.1}
              onChange={(v) => set('pointSize', v)}
            />
            <Slider
              label="Opacity"
              value={config.opacity}
              min={0.05}
              max={1}
              onChange={(v) => set('opacity', v)}
            />
            <Slider
              label="Soft sprites"
              value={config.softSprites}
              min={0}
              max={1}
              onChange={(v) => set('softSprites', v)}
            />
            <Slider
              label="Rim light"
              value={config.rimIntensity}
              min={0}
              max={1}
              onChange={(v) => set('rimIntensity', v)}
            />
            <Color label="Particles" value={config.color} onChange={(v) => set('color', v)} />
            <Color
              label="Background"
              value={config.background}
              onChange={(v) => set('background', v)}
            />
          </Group>

          <Group title="Motion">
            <Slider
              label="Time scale"
              value={config.timeScale}
              min={0}
              max={3}
              step={0.01}
              onChange={(v) => set('timeScale', v)}
            />
            <Slider
              label="Auto spin"
              value={config.autoSpin}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) => set('autoSpin', v)}
            />
            <Switch
              label="Drag to orbit"
              checked={config.dragToOrbit}
              onChange={(v) => set('dragToOrbit', v)}
            />
            <Switch
              label="Click to morph"
              checked={config.clickToMorph}
              onChange={(v) => set('clickToMorph', v)}
            />
          </Group>

          <Group title="Cursor">
            <Select
              label="Mode"
              value={config.mouseMode}
              options={MOUSE_OPTIONS}
              onChange={(v) => set('mouseMode', v)}
            />
            <Slider
              label="Intensity"
              value={config.mouseIntensity}
              min={0}
              max={1}
              measured={Math.abs(config.mouseIntensity - 0.2) < 1e-6}
              onChange={(v) => set('mouseIntensity', v)}
            />
            <Slider
              label="Radius"
              value={config.mouseRadius}
              min={0.1}
              max={3}
              measured={Math.abs(config.mouseRadius - 1.2) < 1e-6}
              onChange={(v) => set('mouseRadius', v)}
            />
          </Group>

          <Group title="Glass">
            <Switch label="Enabled" checked={config.glass} onChange={(v) => set('glass', v)} />
            {config.glass && (
              <>
                <Slider
                  label="Radius"
                  value={config.glassRadius}
                  min={0.3}
                  max={1.4}
                  onChange={(v) => set('glassRadius', v)}
                />
                <Slider
                  label="Refraction"
                  value={config.glassRefraction}
                  min={0}
                  max={1}
                  onChange={(v) => set('glassRefraction', v)}
                />
                <Slider
                  label="Frost"
                  value={config.glassFrost}
                  min={0}
                  max={16}
                  step={0.1}
                  onChange={(v) => set('glassFrost', v)}
                />
                <Slider
                  label="Dispersion"
                  value={config.glassDispersion}
                  min={0}
                  max={16}
                  step={0.1}
                  onChange={(v) => set('glassDispersion', v)}
                />
                <Slider
                  label="Edge light"
                  value={config.glassRim}
                  min={0}
                  max={1.5}
                  onChange={(v) => set('glassRim', v)}
                />
                <Slider
                  label="Specular"
                  value={config.glassSpecular}
                  min={0}
                  max={1.5}
                  onChange={(v) => set('glassSpecular', v)}
                />
                <Color
                  label="Tint"
                  value={config.glassTint}
                  onChange={(v) => set('glassTint', v)}
                />
                <Slider
                  label="Tint mix"
                  value={config.glassTintMix}
                  min={0}
                  max={1}
                  onChange={(v) => set('glassTintMix', v)}
                />
              </>
            )}
          </Group>
        </div>

        <div className="panel__foot">
          <button className="btn" onClick={() => setConfig(DEFAULT_CONFIG)}>
            Reset
          </button>
          <button className="btn btn--primary" onClick={() => setSheet('jsx')}>
            Get the code
          </button>
        </div>
      </div>

      {sheet && (
        <div className="sheet" onClick={() => setSheet(null)}>
          <div className="sheet__card" onClick={(e) => e.stopPropagation()}>
            <div className="sheet__head">
              <span>{sheet === 'jsx' ? 'Component' : 'Config object'}</span>
              <button className="chip" onClick={() => setSheet(null)}>
                Close
              </button>
            </div>
            <pre className="sheet__code">{code}</pre>
            <div className="sheet__foot">
              <button
                className="btn"
                onClick={() => setSheet(sheet === 'jsx' ? 'config' : 'jsx')}
              >
                {sheet === 'jsx' ? 'As config object' : 'As JSX'}
              </button>
              <button className="btn btn--primary" onClick={copy}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
