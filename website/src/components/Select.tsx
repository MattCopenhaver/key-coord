import { useState, useRef } from 'react'

interface Option {
  value: string
  label: string
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder: string
  className?: string
}

export default function Select ({ value, onChange, options, placeholder, className = '' }: SelectProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedLabel = options.find(o => o.value === value)?.label

  const select = (v: string): void => {
    onChange(v)
    setOpen(false)
  }

  const onBlur = (e: React.FocusEvent): void => {
    if (containerRef.current?.contains(e.relatedTarget as Node) === true) return
    setOpen(false)
  }

  return (
    <div ref={containerRef} className={`relative ${className}`} onBlur={onBlur}>
      <button
        type="button"
        onClick={() => { setOpen(o => !o) }}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm transition focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
      >
        <span className={selectedLabel !== undefined ? 'text-white' : 'text-slate-500'}>
          {selectedLabel ?? placeholder}
        </span>
        <svg className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <ul className="absolute z-10 mt-1 min-w-full w-max overflow-auto rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-xl max-h-60">
          <li
            onMouseDown={() => { select('') }}
            className={`cursor-pointer px-3 py-2 text-sm transition-colors ${
              value === '' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:bg-slate-700 hover:text-white'
            }`}
          >
            {placeholder}
          </li>
          {options.map(option => (
            <li
              key={option.value}
              onMouseDown={() => { select(option.value) }}
              className={`cursor-pointer px-3 py-2 text-sm transition-colors ${
                value === option.value ? 'bg-amber-500 text-slate-950' : 'text-white hover:bg-slate-700'
              }`}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
