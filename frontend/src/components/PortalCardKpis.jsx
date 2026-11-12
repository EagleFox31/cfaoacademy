import useLocale from '../hooks/useLocale.js'

/**
 * Données d'une carte du portail, écrites comme dans les cartes du portail DPS :
 * une rangée de cases, libellé en haut, valeur dessous
 * (`portal-team-member-subcards`). À passer dans la prop `meta` d'une PvCard.
 */
export default function PortalCardKpis({ items }) {
  const { locale } = useLocale('common')
  const nombre = n => (typeof n === 'number' ? n.toLocaleString(locale) : n)

  return (
    <div className="portal-team-member-subcards portal-team-member-subcards--chiffres">
      <div className="portal-team-member-subcards-row">
        {items.filter(Boolean).map(({ value, total, unit, label }) => (
          <div key={label} className="portal-team-member-subcard">
            <span className="portal-team-member-subcard-lbl">{label}</span>
            <span className="portal-team-member-subcard-val">
              {nombre(value)}
              {unit ? ` ${unit}` : ''}
              {total != null ? ` / ${nombre(total)}` : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
