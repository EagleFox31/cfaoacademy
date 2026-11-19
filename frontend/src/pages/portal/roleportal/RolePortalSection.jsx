import PortalReveal from '../../../components/PortalReveal.jsx'
import PortalStaggerGrid from '../../../components/PortalStaggerGrid.jsx'
import RolePortalCard from './RolePortalCard.jsx'
import { isVisible } from './visibility.js'

/** En-tête de section du portail : surtitre et titre. */
function TeteSection({ surtitre, titre }) {
  return (
    <div className="portal-section-head">
      <p className="portal-section-eyebrow">{surtitre}</p>
      <h2 className="portal-section-title">{titre}</h2>
    </div>
  )
}

/**
 * Une section d'un portail par configuration, rendue selon son `kind` :
 * `priorities` et `cards` (cartes à compteur ou à pastille fixe),
 * `construction` (annoncée, sans lien), `rich` (composant métier fourni par
 * l'entrée du rôle). Avec `wrap: false`, le composant riche porte lui-même
 * son ancre et son en-tête.
 */
export default function RolePortalSection({ config, section, env, texte, values, rich, viewportRef, onLink, richProps }) {
  const Riche = section.kind === 'rich' ? rich?.[section.render] : null
  if (section.kind === 'rich' && !Riche) throw new Error(`Section riche non fournie : ${section.render}`)
  if (Riche && section.wrap === false) return <Riche section={section} {...richProps} />

  const viewport = config.viewportSection === section.id
  const construction = section.kind === 'construction'
    ? { ...config.construction, ...section.construction }
    : null
  const cartes = (section.cards ?? []).filter(c => isVisible(c, env))
  return (
    <PortalReveal id={section.id} className={viewport ? 'portal-next-actions-viewport' : undefined}>
      <div ref={viewport ? viewportRef : undefined} className="container" style={{ padding: '16px 32px' }}>
        {section.head && <TeteSection surtitre={texte(section.head.eyebrow)} titre={texte(section.head.title)} />}
        {Riche ? <Riche section={section} {...richProps} /> : (
          <PortalStaggerGrid>
            {cartes.map(card => (
              <div key={card.id} className="portal-card-anchor">
                <RolePortalCard
                  card={card}
                  construction={construction}
                  texte={texte}
                  value={card.count == null ? null
                    : typeof card.count === 'number' ? card.count : values?.[card.count]}
                  observer={config.observer}
                  onLink={onLink}
                />
              </div>
            ))}
          </PortalStaggerGrid>
        )}
      </div>
    </PortalReveal>
  )
}
