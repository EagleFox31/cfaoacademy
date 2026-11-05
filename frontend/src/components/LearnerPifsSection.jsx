import PortalSectionEyebrow from './PortalSectionEyebrow.jsx'
import PortalReveal from './PortalReveal.jsx'
import PortalStaggerGrid from './PortalStaggerGrid.jsx'
import PvCard from './PvCard.jsx'

export default function LearnerPifsSection({
  user,
  lms,
  t,
  onOpenPif,
  id = 'pifs',
}) {
  const pifCards = [
    {
      id: 'pif-pluri',
      scope: 'pluri',
      title: 'PIF Pluriannuel · Vision Métier',
      scopeBadge: 'Pluriannuel',
      statusLabel: 'Validé',
      statusClass: 'done',
      progress: 75,
      img: '/assets/img_cards/equipment_niveau_3_test_pratique.png',
      accentColor: '#1aab5b',
      cta: 'Consulter le parcours',
      details: {
        title: 'Plan Individuel de Formation Pluriannuel',
        subtitle: 'Trajectoire vers la certification Diagnostic Expert',
        brand: 'Renault Trucks & Sinotruk',
        modules: [
          { name: 'Chaîne cinématique & Optidriver (RT)', status: 'Validé', date: 'Mars 2026' },
          { name: 'Injection Common Rail & Moteur WD615 (Sinotruk)', status: 'Validé', date: 'Janv. 2026' },
          { name: 'Diagnostic multiplexage & calculateurs', status: 'À venir', date: 'Oct. 2026' },
          { name: 'Dépannage avancé systèmes antipollution Euro 5/6', status: 'Objectif 2027', date: '2027' },
        ],
      },
    },
    {
      id: 'pif-2026',
      scope: '2026',
      title: 'PIF 2026',
      scopeBadge: null,
      statusLabel: 'En cours',
      statusClass: 'progress',
      progress: 50,
      img: '/assets/img_cards/equipment_niveau_2_test_pratique.png',
      accentColor: '#0284c7',
      cta: 'Voir le programme 2026',
      details: {
        title: 'Plan de Formation Annuel 2026',
        subtitle: 'Sessions présentielles CFAO Academy Douala',
        brand: 'Renault Trucks & Sinotruk',
        modules: [
          { name: 'Moteur WD615 & Injection Common Rail', status: 'Fait', date: '28 janv. 2026' },
          { name: 'Freinage EBS & Suspension pneumatique', status: 'Fait', date: '12 févr. 2026' },
          { name: 'Chaîne cinématique & Boîte Optidriver', status: 'En cours', date: '18 mars 2026' },
          { name: 'Diagnostic électronique TIS & K-Range', status: 'Programmé', date: '15 oct. 2026' },
        ],
      },
    },
    {
      id: 'pif-2025',
      scope: '2025',
      title: 'PIF 2025',
      scopeBadge: null,
      statusLabel: 'Clôturé',
      statusClass: 'closed',
      progress: 100,
      img: '/assets/img_cards/equipment_niveau_1_test_pratique.png',
      accentColor: '#1aab5b',
      cta: 'Consulter le bilan 2025',
      details: {
        title: 'Bilan de Formation Annuel 2025',
        subtitle: 'Bilan validé par la filiale CFAO MOBILITY CAMEROUN',
        brand: 'Renault Trucks & Sinotruk',
        modules: [
          { name: 'Entretien périodique & Contrôles réglementaires', status: 'Validé', date: 'Mai 2025' },
          { name: 'Circuits hydrauliques & Électricité de base', status: 'Validé', date: 'Sept. 2025' },
          { name: 'Ponts & Boîte HW19710 Sinotruk', status: 'Validé', date: 'Déc. 2025' },
        ],
      },
    },
  ]

  return (
    <PortalReveal id={id}>
      <div className="container" style={{ padding: '16px 32px' }}>
        <div className="portal-section-head">
          <PortalSectionEyebrow icon="target" label="Amélioration Continue" />
          <h2 className="portal-section-title">Mes PIFs (Plans Individuels de Formation)</h2>
        </div>

        <PortalStaggerGrid className="cols-4 pv-grid--stretch">
          {pifCards.map((p) => (
            <div key={p.id} id={`portal-card-${p.id}`} className="portal-card-anchor">
              <PvCard
                className="pv-card--pif"
                img={p.img}
                kicker={
                  <span className="pv-card-kicker-row">
                    <span className={`portal-status-chip ${p.statusClass}`}>
                      {p.statusLabel}
                    </span>
                    {p.scopeBadge ? (
                      <span className="portal-pif-scope-badge">
                        {p.scopeBadge}
                      </span>
                    ) : null}
                  </span>
                }
                title={p.title}
                meta={
                  <div className="portal-pif-progress-wrap">
                    <div className="portal-pif-progress-head">
                      <span className="portal-pif-progress-label">Progression</span>
                      <span className="portal-pif-progress-pct" style={{ color: p.accentColor }}>
                        {p.progress}%
                      </span>
                    </div>
                    <div className="portal-pif-progress-track">
                      <div
                        className="portal-pif-progress-fill"
                        style={{
                          '--target-width': `${p.progress}%`,
                          backgroundColor: p.accentColor,
                        }}
                      />
                    </div>
                  </div>
                }
                cta={p.cta}
                accentColor={p.accentColor}
                onClick={() => onOpenPif?.(p)}
                hoverHint="Consulter le détail du plan"
                corner
              />
            </div>
          ))}
        </PortalStaggerGrid>
      </div>
    </PortalReveal>
  )
}
