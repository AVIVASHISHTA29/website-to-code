import { DEFAULT_CONFIG, WOBBLE, type BlobConfig } from '../blob/config'

const WOBBLE_BY_ID = new Map(
  Object.entries(WOBBLE).map(([name, id]) => [id as number, name]),
)

function format(value: unknown): string {
  if (typeof value === 'string') return `'${value}'`
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)))
  }
  return String(value)
}

/** Only the props that differ from the defaults — the rest are already defaults. */
export function changedKeys(config: BlobConfig): (keyof BlobConfig)[] {
  return (Object.keys(config) as (keyof BlobConfig)[]).filter(
    (k) => config[k] !== DEFAULT_CONFIG[k],
  )
}

export function toJsx(config: BlobConfig): string {
  const keys = changedKeys(config)
  if (keys.length === 0) return `<Blob />`

  const lines = keys.map((k) => {
    const value = config[k]
    if ((k === 'wobbleFrom' || k === 'wobbleTo') && typeof value === 'number') {
      return `  ${k}={WOBBLE.${WOBBLE_BY_ID.get(value) ?? value}}`
    }
    if (typeof value === 'string') return `  ${k}="${value}"`
    if (value === true) return `  ${k}`
    return `  ${k}={${format(value)}}`
  })

  const needsWobble = keys.some((k) => k === 'wobbleFrom' || k === 'wobbleTo')
  const importLine = needsWobble
    ? `import { Blob, WOBBLE } from './blob'`
    : `import { Blob } from './blob'`

  return `${importLine}

<Blob
${lines.join('\n')}
/>`
}

export function toConfigObject(config: BlobConfig): string {
  const keys = changedKeys(config)
  const lines = keys.map((k) => {
    const value = config[k]
    if ((k === 'wobbleFrom' || k === 'wobbleTo') && typeof value === 'number') {
      return `  ${k}: WOBBLE.${WOBBLE_BY_ID.get(value) ?? value},`
    }
    return `  ${k}: ${format(value)},`
  })
  const needsWobble = keys.some((k) => k === 'wobbleFrom' || k === 'wobbleTo')
  const names = needsWobble ? 'DEFAULT_CONFIG, WOBBLE' : 'DEFAULT_CONFIG'

  return `import { ${names}, type BlobConfig } from './blob'

export const myBlob: BlobConfig = {
  ...DEFAULT_CONFIG,
${lines.join('\n')}
}`
}
