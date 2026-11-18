import { useMemo } from 'react'
import { PAYS } from '../data/index.js'
import useLocale from '../hooks/useLocale.js'
import { localizedCountryName } from '../utils/localizeGeo.js'
import { drapeauUrl } from '../utils/drapeau.js'

export default function FlagMarquee() {
  const { locale } = useLocale('countries')

  const actifs = useMemo(
    () => PAYS.filter((p) => p.actif).map((p) => ({
      ...p,
      label: localizedCountryName(p.name, locale, p.code),
    })),
    [locale],
  )

  const row = actifs.map((p) => (
    <div className="flag-pill" key={p.code}>
      <img
        src={drapeauUrl(p.code)}
        alt={p.label}
        width="28"
        height="21"
        loading="lazy"
        decoding="async"
      />
      <span>{p.label}</span>
    </div>
  ))

  return (
    <div className="marquee-wrap flag-marquee-wrap">
      <div className="marquee reverse">{row}{row}</div>
    </div>
  )
}
