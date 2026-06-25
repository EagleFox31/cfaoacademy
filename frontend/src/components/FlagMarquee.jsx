import { useMemo } from 'react'
import { PAYS } from '../data/index.js'
import useLocale from '../hooks/useLocale.js'
import { localizedCountryName } from '../utils/localizeGeo.js'

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
        src={`https://flagcdn.com/w40/${p.code}.png`}
        srcSet={`https://flagcdn.com/w80/${p.code}.png 2x`}
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
