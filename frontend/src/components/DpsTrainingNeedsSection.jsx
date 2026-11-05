import PortalSectionEyebrow from './PortalSectionEyebrow.jsx'
import PortalSectionHead from './PortalSectionHead.jsx'
import PortalReveal from './PortalReveal.jsx'
import PvCard from './PvCard.jsx'

const CAMPAIGNS = [
  {
    year: 2027,
    title: 'Identification des besoins en formation',
    statusLabel: 'À faire',
    statusClass: 'progress',
    yearChipClass: 'portal-campaign-year-chip--future',
    img: '/assets/formation_motorisation_centre_formation.jpg',
    accentColor: '#1a56db',
    cta: 'Lancer la campagne 2027',
    metaItems: [
      { label: 'Campagne', value: 'Exercice 2027' },
      { label: 'Échéance', value: 'Q4 2026' },
    ],
  },
  {
    year: 2026,
    title: 'Identification des besoins en formation',
    statusLabel: 'Faite',
    statusClass: 'done',
    yearChipClass: 'portal-campaign-year-chip--current',
    img: '/assets/technicien_multibrand.jpg',
    accentColor: '#1aab5b',
    cta: 'Consulter le bilan 2026',
    metaItems: [
      { label: 'Campagne', value: 'Exercice 2026' },
      { label: 'Statut', value: '—' },
    ],
  },
  {
    year: 2025,
    title: 'Identification des besoins en formation',
    statusLabel: 'Faite',
    statusClass: 'done',
    yearChipClass: 'portal-campaign-year-chip--past',
    img: '/assets/technicien_equipment.jpg',
    accentColor: '#64748b',
    cta: "Consulter l'historique 2025",
    metaItems: [
      { label: 'Campagne', value: 'Exercice 2025' },
      { label: 'Statut', value: 'Clôturée' },
    ],
  },
]

export default function DpsTrainingNeedsSection({
  t,
  sectionId = 'besoins-formation',
  updatedAt,
}) {
  return (
    <PortalReveal as="section" id={sectionId} className="portal-dps-training-needs-section">
      <div className="container" style={{ padding: '16px 32px' }}>
        <PortalSectionHead
          eyebrow={<PortalSectionEyebrow icon="clipboard" label="MESURE DES BESOINS EN FORMATION" />}
          title="Identification Annuelle des besoins en formations de votre filiale"
          updatedAt={updatedAt}
          t={t}
        />

        <div className="pv-grid cols-3 pv-grid--stretch">
          {CAMPAIGNS.map(item => (
            <PvCard
              key={item.year}
              className={`portal-campaign-card portal-campaign-card--${item.year}`}
              img={item.img}
              accentColor={item.accentColor}
              kicker={(
                <span className="pv-card-kicker-row">
                  <span className={`portal-status-chip ${item.statusClass}`}>
                    {item.statusLabel}
                  </span>
                  <span className={`portal-campaign-year-chip ${item.yearChipClass}`}>
                    {item.year}
                  </span>
                </span>
              )}
              title={item.title}
              meta={(
                <div className="portal-team-member-subcards">
                  <div className="portal-team-member-subcards-row">
                    {item.metaItems.map(m => (
                      <div key={m.label} className="portal-team-member-subcard">
                        <span className="portal-team-member-subcard-lbl">{m.label}</span>
                        <span className="portal-team-member-subcard-val">{m.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              cta={item.cta}
              hoverHint={item.cta}
              to="#pif"
              corner
            />
          ))}
        </div>
      </div>
    </PortalReveal>
  )
}
