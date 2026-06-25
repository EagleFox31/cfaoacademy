import { useEffect, useId, useMemo, useRef, useState } from 'react'
import ComboFlag from './ComboFlag.jsx'

export default function SubjectCombobox({
  id,
  label,
  hint,
  placeholder,
  options = [],
  value,
  onChange,
  disabled,
  invalid,
  errorId,
  describedBy,
  /** @type {(option: string) => { src: string, srcSet?: string } | null} */
  resolveFlag,
}) {
  const listId = useId()
  const rootRef = useRef(null)
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.toLowerCase().includes(q))
  }, [options, value])

  useEffect(() => {
    const onDocClick = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const pick = (option) => {
    onChange(option)
    setOpen(false)
  }

  const showList = open && filtered.length > 0 && !disabled
  const inputFlag = resolveFlag?.(value) ?? null

  return (
    <div className="login-field subject-combobox" ref={rootRef}>
      <label className="login-label" htmlFor={id}>{label}</label>
      <div className="subject-combobox-wrap">
        <div className={`subject-combobox-input-wrap${inputFlag ? ' has-flag' : ''}`}>
          {inputFlag && (
            <ComboFlag
              src={inputFlag.src}
              srcSet={inputFlag.srcSet}
              className="subject-combobox-input-flag combo-flag"
            />
          )}
          <input
          id={id}
          type="text"
          role="combobox"
          className={`login-input subject-combobox-input${inputFlag ? ' has-leading-flag' : ''}${invalid ? ' is-invalid' : ''}`}
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          aria-invalid={invalid}
          aria-describedby={[hint ? `${id}-hint` : null, describedBy, errorId].filter(Boolean).join(' ') || undefined}
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          disabled={disabled}
        />
        </div>
        {showList && (
          <ul className="subject-combobox-list" id={listId} role="listbox">
            {filtered.map((option) => {
              const flag = resolveFlag?.(option) ?? null
              return (
              <li key={option} role="option" aria-selected={option === value}>
                <button
                  type="button"
                  className={`subject-combobox-option${option === value ? ' is-selected' : ''}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(option)}
                >
                  {flag && (
                    <ComboFlag
                      src={flag.src}
                      srcSet={flag.srcSet}
                      className="subject-combobox-option-flag combo-flag"
                    />
                  )}
                  <span className="subject-combobox-option-label">{option}</span>
                </button>
              </li>
              )
            })}
          </ul>
        )}
      </div>
      {hint && (
        <p className="subject-combobox-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
    </div>
  )
}
