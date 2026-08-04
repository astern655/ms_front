import { useState } from 'react'

export type Option = { value: string; label: string }

// App-styled dropdown replacing native <select> (glass menu, ellipsis labels).
export function Select({
  value,
  options,
  onChange,
  placeholder = '선택',
}: {
  value: string
  options: Option[]
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const current = options.find((o) => o.value === value)
  return (
    <div className="select2">
      <button
        type="button"
        className="select2-btn"
        onClick={() => setOpen((v) => !v)}
        title={current?.label}
      >
        <span className="select2-label">{current?.label ?? placeholder}</span>
        <span className="caret">▾</span>
      </button>
      {open && (
        <>
          <div className="menu-catch" onClick={() => setOpen(false)} />
          <div className="select2-menu glass">
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                className={o.value === value ? 'on' : ''}
                onClick={() => {
                  onChange(o.value)
                  setOpen(false)
                }}
              >
                {o.label}
              </button>
            ))}
            {options.length === 0 && <span className="select2-empty">항목 없음</span>}
          </div>
        </>
      )}
    </div>
  )
}
