import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

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
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selectedLabel = options.find(o => o.value === value)?.label

  const select = (v: string): void => {
    onChange(v)
    setOpen(false)
  }

  const toggleOpen = (): void => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        minWidth: rect.width,
        zIndex: 9999,
      })
    }
    setOpen(o => !o)
  }

  useEffect(() => {
    if (!open) return
    const handleMouseDown = (e: MouseEvent): void => {
      if (
        buttonRef.current?.contains(e.target as Node) === false &&
        listRef.current?.contains(e.target as Node) === false
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => { document.removeEventListener('mousedown', handleMouseDown) }
  }, [open])

  return (
    <div className={className}>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm transition focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
      >
        <span className={selectedLabel !== undefined ? 'text-white' : 'text-slate-500'}>
          {selectedLabel ?? placeholder}
        </span>
        <svg className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {open && createPortal(
        <ul
          ref={listRef}
          style={dropdownStyle}
          className="overflow-auto rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-xl max-h-60"
        >
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
        </ul>,
        document.body,
      )}
    </div>
  )
}
