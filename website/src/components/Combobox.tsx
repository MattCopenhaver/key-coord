import { useState, useRef, useEffect } from 'react'

interface ComboboxProps {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder: string
  disabled?: boolean
  className?: string
}

export default function Combobox ({ value, onChange, options, placeholder, disabled = false, className = '' }: ComboboxProps) {
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    setQuery(value)
  }, [value])

  useEffect(() => {
    if (listRef.current !== null) {
      const item = listRef.current.children[highlighted] as HTMLElement | undefined
      item?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlighted])

  const filtered = query === '' || query === value
    ? options
    : options.filter(o => o.toLowerCase().includes(query.toLowerCase()))

  const select = (option: string) => {
    onChange(option)
    setQuery(option)
    setOpen(false)
    setHighlighted(0)
  }

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    setHighlighted(0)
    setOpen(true)
    if (e.target.value === '') onChange('')
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(h => Math.min(h + 1, filtered.length - 1))
      setOpen(true)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter' && open && filtered[highlighted] !== undefined) {
      e.preventDefault()
      select(filtered[highlighted])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const onBlur = (e: React.FocusEvent) => {
    if (containerRef.current?.contains(e.relatedTarget as Node) === true) return
    setOpen(false)
    if (!options.includes(query)) setQuery(value)
  }

  return (
    <div ref={containerRef} className={`relative ${className}`} onBlur={onBlur}>
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        disabled={disabled}
        onChange={onInputChange}
        onFocus={() => { setOpen(true) }}
        onKeyDown={onKeyDown}
        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 transition focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
      />
      {open && filtered.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-xl"
        >
          {filtered.map((option, i) => (
            <li
              key={option}
              onMouseDown={() => { select(option) }}
              className={`cursor-pointer px-3 py-2 text-sm transition-colors ${
                i === highlighted
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-white hover:bg-slate-700'
              }`}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
