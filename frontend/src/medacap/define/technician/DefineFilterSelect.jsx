import { useEffect, useId, useRef, useState } from 'react'

export function defineFilterOptionLabel(opt, t) {
  return opt.labelKey ? t[opt.labelKey] : opt.label
}

export default function DefineFilterSelect({
  value,
  options,
  onChange,
  t,
  labelledBy,
  listAriaLabel,
  renderLeading,
  variant,
}) {
  const listId = useId()
  const rootRef = useRef(null)
  const [open, setOpen] = useState(false)
  const hasLeading = Boolean(renderLeading)

  const selected = options.find(opt => opt.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return undefined

    function onDocClick(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function pick(nextValue) {
    onChange(nextValue)
    setOpen(false)
  }

  const rootClass = [
    'define-tech-filter-dropdown',
    variant === 'brand' && 'define-tech-filter-dropdown--brand',
  ].filter(Boolean).join(' ')

  const optionClass = opt => [
    'define-tech-filter-dropdown-option',
    hasLeading && 'define-tech-filter-dropdown-option--with-leading',
    opt.value === value && 'define-tech-filter-dropdown-option--active',
  ].filter(Boolean).join(' ')

  return (
    <div className={rootClass} ref={rootRef}>
      <button
        type="button"
        className="define-tech-filter-select define-tech-filter-dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={labelledBy}
        onClick={() => setOpen(prev => !prev)}
      >
        <span className="define-tech-filter-dropdown-value">
          {hasLeading && selected ? renderLeading(selected) : null}
          <span className="define-tech-filter-dropdown-label">
            {selected ? defineFilterOptionLabel(selected, t) : ''}
          </span>
        </span>
      </button>

      {open ? (
        <ul
          id={listId}
          className="define-tech-filter-dropdown-menu"
          role="listbox"
          aria-label={listAriaLabel}
        >
          {options.map(opt => {
            const active = opt.value === value
            return (
              <li key={opt.value} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={optionClass(opt)}
                  onClick={() => pick(opt.value)}
                >
                  {hasLeading ? renderLeading(opt) : null}
                  <span className="define-tech-filter-dropdown-label">
                    {defineFilterOptionLabel(opt, t)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
