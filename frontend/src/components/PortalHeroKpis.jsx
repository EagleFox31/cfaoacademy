import { scrollToPortalSection } from '../utils/portalScroll.js'

/**
 * Chiffres cliquables sous la phrase du hero d'un portail : ce qui reste à
 * faire, et un clic descend là où on le fait. `kpis` : `{ id, valeur, label,
 * cible }` ; `values[valeur]` : le nombre, ou `null` sans donnée (« — »,
 * jamais de chiffre inventé). Libellés : `label`, `label_one` (1),
 * `label_zero` (0, une phrase qui rassure).
 */
export default function PortalHeroKpis({ kpis, t, values, grille = 'cols-4' }) {
  // `grille` : celle des cartes des sections de la page, pour que les colonnes tombent juste.
  return (
    <div className={`pv-grid ${grille} portal-hero-kpis`}>
      {kpis.map(k => {
        const n = values?.[k.valeur]
        const connu = Number.isFinite(n)
        const ton = !connu ? '' : n > 0 ? ' progress' : ' green'
        const libelle = !connu ? t[k.label]
          : n === 0 ? t[`${k.label}_zero`]
            : n === 1 ? t[`${k.label}_one`] ?? t[k.label] : t[k.label]
        return (
          <button key={k.id} type="button" className="portal-kpi-card portal-hero-kpi"
            data-kpi={k.id} onClick={() => scrollToPortalSection(k.cible)}>
            <span className={`portal-kpi-value${ton}`}>{connu ? n : '—'}</span>
            <span className="portal-kpi-label">{libelle}</span>
          </button>
        )
      })}
    </div>
  )
}
