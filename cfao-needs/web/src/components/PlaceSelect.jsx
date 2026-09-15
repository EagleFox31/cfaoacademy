import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { useLocale } from '../i18n'
import { countryFlag } from '../lib/assets'
import { ACADEMY_COUNTRY, placeOptionsFor } from '../lib/placeRules'

/**
 * Lieu de formation — même interaction que LocaleSwitch (bouton + menu drapeau).
 *
 * CFR = Academy de Douala. FILIALE = l'unité org du déclarant (agence Cameroun
 * ou filiale hors CM), jamais un libellé générique « Agency ».
 */
export default function PlaceSelect({
  value,
  onChange,
  disabled = false,
  country = '',
  headcount = 0,
  orgUnitLabel = '',
  'aria-label': ariaLabel,
}) {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  const [menuBox, setMenuBox] = useState(null)
  const rootRef = useRef(null)
  const menuRef = useRef(null)
  const listId = useId()

  const allowed = placeOptionsFor(country, headcount)
  const lockedChoice = allowed.length === 1
  const localLabel = orgUnitLabel?.trim() || t('grid.placeFILIALE')

  const options = allowed.map((place) => ({
    value: place,
    label: place === 'CFR' ? t('grid.placeCFR') : localLabel,
    flag: countryFlag(place === 'CFR' ? ACADEMY_COUNTRY : country),
  }))

  const selected =
    options.find((o) => o.value === value) ??
    options.find((o) => o.value === allowed[0]) ??
    options[0]

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return undefined
    const sync = () => {
      const rect = rootRef.current.getBoundingClientRect()
      setMenuBox({
        top: rect.bottom + 6,
        left: rect.left,
        width: Math.max(rect.width, 220),
      })
    }
    sync()
    window.addEventListener('scroll', sync, true)
    window.addEventListener('resize', sync)
    return () => {
      window.removeEventListener('scroll', sync, true)
      window.removeEventListener('resize', sync)
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    function onPointerDown(event) {
      const target = event.target
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const canOpen = !disabled && !lockedChoice

  return (
    <div
      className={`place-select${disabled || lockedChoice ? ' place-select--disabled' : ''}`}
      ref={rootRef}
    >
      <button
        type="button"
        className="place-select__trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => {
          if (!canOpen) return
          setOpen((v) => !v)
        }}
      >
        {selected?.flag ? (
          <img src={selected.flag} alt="" className="place-select__flag" width={22} height={15} />
        ) : null}
        <span className="place-select__label">{selected?.label}</span>
        {canOpen && (
          <span className="place-select__caret" aria-hidden="true">
            {open ? '▴' : '▾'}
          </span>
        )}
      </button>

      {open &&
        canOpen &&
        menuBox &&
        createPortal(
          <div
            ref={menuRef}
            id={listId}
            className="place-select__menu"
            role="listbox"
            style={{
              position: 'fixed',
              top: menuBox.top,
              left: menuBox.left,
              width: menuBox.width,
            }}
          >
            {options.map((option) => {
              const active = option.value === selected?.value
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`place-select__option${active ? ' is-active' : ''}`}
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                >
                  {option.flag ? (
                    <img
                      src={option.flag}
                      alt=""
                      className="place-select__flag"
                      width={22}
                      height={15}
                    />
                  ) : null}
                  <span>{option.label}</span>
                </button>
              )
            })}
          </div>,
          document.body,
        )}
    </div>
  )
}
