import PortalSectionEyebrow from './PortalSectionEyebrow.jsx'
import PortalReveal from './PortalReveal.jsx'
import PortalStaggerGrid from './PortalStaggerGrid.jsx'
import PvCard from './PvCard.jsx'

const TRAINING_REPORTS = [
  {
    id: 'rep-rt-optidriver',
    brand: 'renault-trucks',
    title: 'Rapport de formation Chaîne cinématique & Boîte Optidriver du 18 mars 2026 à Douala',
    date: '18 mars 2026',
    city: 'Douala',
    score: '92%',
    status: 'done',
    statusLabel: 'Validé',
    trainerName: 'Lucien GAGNE',
    trainerRole: 'Formateur Renault Trucks',
    trainerPhoto: '/assets/team/lucien-gagne.png',
    brandLogo: '/assets/logos/renault-trucks.png',
    brandLabel: 'Renault Trucks',
    img: '/assets/img_cards/formation_niveau_2_test_pratique.png',
    accentColor: '#1aab5b',
    details: {
      theme: 'Chaîne cinématique & Boîte robotisée Optidriver',
      brand: 'Renault Trucks',
      location: 'Centre CFAO Academy Douala',
      duration: '5 jours (35 heures)',
      trainer: 'Lucien GAGNE',
      evaluation: 'Excellente maîtrise du calibrage des embrayages et des procédures de diagnostic logiciel.',
      practicalScore: '92/100',
    },
  },
  {
    id: 'rep-rt-ebs',
    brand: 'renault-trucks',
    title: 'Rapport de formation Freinage EBS & Suspension pneumatique du 12 février 2026 à Douala',
    date: '12 févr. 2026',
    city: 'Douala',
    score: '88%',
    status: 'done',
    statusLabel: 'Validé',
    trainerName: 'Lucien GAGNE',
    trainerRole: 'Formateur Renault Trucks',
    trainerPhoto: '/assets/team/lucien-gagne.png',
    brandLogo: '/assets/logos/renault-trucks.png',
    brandLabel: 'Renault Trucks',
    img: '/assets/img_cards/equipment_niveau_2_test_pratique.png',
    accentColor: '#1aab5b',
    details: {
      theme: 'Circuits de freinage pneumatique EBS & Suspensions pilotées',
      brand: 'Renault Trucks',
      location: 'Centre CFAO Academy Douala',
      duration: '4 jours (28 heures)',
      trainer: 'Lucien GAGNE',
      evaluation: 'Bonne rigueur sur la détection des fuites pneumatiques et le contrôle des modulateurs.',
      practicalScore: '88/100',
    },
  },
  {
    id: 'rep-sino-wd615',
    brand: 'sinotruk',
    title: 'Rapport de formation Moteur WD615 & Injection Common Rail du 28 janvier 2026 à Douala',
    date: '28 janv. 2026',
    city: 'Douala',
    score: '85%',
    status: 'done',
    statusLabel: 'Validé',
    trainerName: 'Idris NKOA',
    trainerRole: 'Formateur Sinotruk',
    trainerPhoto: '/assets/team/idris-nkoa.png',
    brandLogo: '/assets/logos/sinotruk.png',
    brandLabel: 'Sinotruk',
    img: '/assets/img_cards/formation_niveau_1_test_pratique.png',
    accentColor: '#1aab5b',
    details: {
      theme: 'Moteur WD615 & Système d’injection haute pression',
      brand: 'Sinotruk',
      location: 'Atelier CFAO Mobility Douala',
      duration: '5 jours (35 heures)',
      trainer: 'Idris NKOA',
      evaluation: 'Très bonne compréhension du calage de distribution et de l’analyse des retours d’injecteurs.',
      practicalScore: '85/100',
    },
  },
  {
    id: 'rep-sino-hw19710',
    brand: 'sinotruk',
    title: 'Rapport de formation Ponts, Boîte HW19710 & Électricité du 15 décembre 2025 à Douala',
    date: '15 déc. 2025',
    city: 'Douala',
    score: '82%',
    status: 'done',
    statusLabel: 'Validé',
    trainerName: 'Idris NKOA',
    trainerRole: 'Formateur Sinotruk',
    trainerPhoto: '/assets/team/idris-nkoa.png',
    brandLogo: '/assets/logos/sinotruk.png',
    brandLabel: 'Sinotruk',
    img: '/assets/img_cards/equipment_niveau_1_test_pratique.png',
    accentColor: '#1aab5b',
    details: {
      theme: 'Boîte mécanique démultipliée HW19710 & Réducteurs de ponts',
      brand: 'Sinotruk',
      location: 'Atelier CFAO Mobility Douala',
      duration: '3 jours (21 heures)',
      trainer: 'Idris NKOA',
      evaluation: 'Bonne autonomie sur le désassemblage et le réglage des jeux de pignonnerie.',
      practicalScore: '82/100',
    },
  },
]

export default function LearnerFormationsSection({
  user,
  lms,
  t,
  onOpenReport,
  id = 'formations',
}) {
  return (
    <PortalReveal id={id}>
      <div className="container" style={{ padding: '16px 32px' }}>
        <div className="portal-section-head">
          <PortalSectionEyebrow icon="book" label="Rapports de formation" />
          <h2 className="portal-section-title">Mes Formations</h2>
        </div>

        <PortalStaggerGrid className="cols-4 pv-grid--stretch">
          {TRAINING_REPORTS.map((rep) => (
            <div key={rep.id} id={`portal-card-${rep.id}`} className="portal-card-anchor">
              <PvCard
                className="pv-card--training-report"
                img={rep.img}
                logo={rep.brandLogo}
                kicker={
                  <span className="pv-card-kicker-row">
                    <span className="portal-status-chip done">{rep.statusLabel}</span>
                  </span>
                }
                title={rep.title}
                meta={
                  <div className="portal-training-card-meta">
                    <div className="portal-training-trainer-row">
                      <img
                        src={rep.trainerPhoto}
                        alt={rep.trainerName}
                        className="portal-training-trainer-avatar"
                        loading="lazy"
                      />
                      <div className="portal-training-trainer-info">
                        <span className="portal-training-trainer-label">Formateur de la marque</span>
                        <span className="portal-training-trainer-name">{rep.trainerName}</span>
                        <span className="portal-training-trainer-role">{rep.trainerRole}</span>
                      </div>
                    </div>
                  </div>
                }
                cta="Consulter le rapport"
                accentColor={rep.accentColor}
                onClick={() => onOpenReport?.(rep)}
                hoverHint="Voir le rapport de formation complet"
                corner
              />
            </div>
          ))}
        </PortalStaggerGrid>
      </div>
    </PortalReveal>
  )
}
