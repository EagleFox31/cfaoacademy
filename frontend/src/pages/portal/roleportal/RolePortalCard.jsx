import PvCard from '../../../components/PvCard'
import PortalConstructionMedia from '../../../components/PortalConstructionMedia.jsx'
import PortalIconMedia from '../../../components/PortalIconMedia.jsx'

/** Le lien d'une carte, s'il mène quelque part maintenant. */
function lienActif(link, n) {
  if (!link) return null
  if (link.section && link.ifCount && !n) return null
  return link
}

/**
 * Seul endroit des portails par configuration qui monte une `PvCard`.
 *
 * Compteur (`card.count` = clé de source) : `null` = pas de nombre,
 * `0` = pastille `done`, `undefined` = encore en chargement (pastille `todo`
 * sans nombre). Pas de flèche dans le CTA : PvCard la pose.
 */
export default function RolePortalCard({ card, construction, texte, value, observer, onLink }) {
  if (construction) {
    return (
      <PvCard
        cardMedia={<PortalConstructionMedia label={texte(construction.label)} />}
        kicker={<span className="portal-status-chip todo">{texte(construction.chip)}</span>}
        title={texte(card.title)}
        meta={texte(card.meta)}
      />
    )
  }

  const n = card.count == null ? null : value
  const lien = observer ? null : lienActif(card.link, n)
  const chip = texte(card.chip?.key)
  const cls = card.chip?.cls ?? (n ? 'alert' : n === undefined ? 'todo' : 'done')
  // Une route interne reste un vrai lien (ouverture dans un onglet, survol).
  const to = lien?.to
  return (
    <PvCard
      img={card.img}
      cardMedia={card.icon ? <PortalIconMedia icon={card.icon} tone={card.iconTone ?? 'open'} /> : undefined}
      to={to}
      kicker={<span className={`portal-status-chip ${cls}`}>{n == null ? chip : `${n} ${chip}`}</span>}
      title={texte(card.title)}
      meta={n !== 0 || card.metaEmpty == null ? texte(card.meta) : texte(card.metaEmpty)}
      cta={lien ? texte(card.cta) : undefined}
      accentColor={card.accent ?? (n ? '#E3001B' : undefined)}
      hoverHint={lien ? texte(card.hint ?? card.cta) : undefined}
      onClick={lien && !to ? () => onLink(lien) : undefined}
      corner={Boolean(lien)}
    />
  )
}
