import type { ReactNode } from 'react'

export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="group">
      <div className="group__title">{title}</div>
      {children}
    </div>
  )
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 0.001,
  measured,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  /** Marks a value the original site actually uses. */
  measured?: boolean
  onChange: (v: number) => void
}) {
  const digits = step >= 1 ? 0 : step >= 0.01 ? 2 : 3
  return (
    <label className="row">
      <span className="row__label">{label}</span>
      <span className={`row__value${measured ? ' row__measured' : ''}`}>
        {value.toFixed(digits)}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

export function Switch({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="switch">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

export function Color({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="row">
      <span className="row__label">{label}</span>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

export function Select<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <label className="row">
      <span className="row__label">{label}</span>
      <select
        value={String(value)}
        onChange={(e) => {
          const raw = e.target.value
          const match = options.find((o) => String(o.value) === raw)
          if (match) onChange(match.value)
        }}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
