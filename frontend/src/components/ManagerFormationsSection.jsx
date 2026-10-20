import PortalSectionEyebrow from './PortalSectionEyebrow.jsx'
import PortalReveal from './PortalReveal.jsx'
import PortalStaggerGrid from './PortalStaggerGrid.jsx'
import PvCard from './PvCard.jsx'

export const TEAM_TRAINING_REPORTS = [
  {
    id: 'rep-lovol-fl936',
    brand: 'lovol',
    title: 'Maintenance préventive chargeuses LOVOL FL936 & pelles FR220 du 14 mai 2026',
    date: '14 mai 2026',
    city: 'Douala',
    score: '90%',
    status: 'done',
    statusLabel: 'Validé',
    collaboratorName: 'Achille Patrick NJIKE KAPNANG',
    collaboratorLevel: 'Maintenance (Junior)',
    agency: 'Yaoundé',
    trainerName: 'Thierry KOUGHA',
    trainerRole: 'Formateur certifié Lovol & Forklift',
    trainerPhoto: '/assets/team/lucien-gagne.png',
    brandLogo: '/assets/logos/lovol.png',
    brandLabel: 'Lovol',
    img: '/assets/img_cards/formation_niveau_1_test_pratique.png',
    accentColor: '#1aab5b',
    details: {
      theme: 'Maintenance préventive & circuits hydrauliques engins Lovol',
      brand: 'Lovol',
      location: 'Centre CFAO Academy Douala',
      duration: '4 jours (28 heures)',
      trainer: 'Thierry KOUGHA',
      evaluation: 'Excellente maîtrise des points de graissage, vidanges et contrôle de pression des circuits hydrauliques.',
      practicalScore: '90/100',
    },
  },
  {
    id: 'rep-sino-wd615-bayemi',
    brand: 'sinotruk',
    title: 'Diagnostic approfondi Moteur Sinotruk WD615 & injection Common Rail du 28 janv. 2026',
    date: '28 janv. 2026',
    city: 'Douala',
    score: '94%',
    status: 'done',
    statusLabel: 'Validé',
    collaboratorName: 'Michel BAYEMI',
    collaboratorLevel: 'Diagnostic (Expert)',
    agency: 'Yaoundé',
    trainerName: 'Idris NKOA',
    trainerRole: 'Formateur référent Sinotruk',
    trainerPhoto: '/assets/team/idris-nkoa.png',
    brandLogo: '/assets/logos/sinotruk.png',
    brandLabel: 'Sinotruk',
    img: '/assets/img_cards/formation_niveau_2_test_pratique.png',
    accentColor: '#1aab5b',
    details: {
      theme: 'Diagnostic avancé injection haute pression & calage distribution',
      brand: 'Sinotruk',
      location: 'Atelier CFAO Mobility Douala',
      duration: '5 jours (35 heures)',
      trainer: 'Idris NKOA',
      evaluation: 'Expertise confirmée sur la détection des pannes d’injecteurs et l’étalonnage des capteurs haute pression.',
      practicalScore: '94/100',
    },
  },
  {
    id: 'rep-rt-optidriver-tchombam',
    brand: 'renault-trucks',
    title: 'Chaîne cinématique & Boîte pilotée Optidriver Renault Trucks du 18 mars 2026',
    date: '18 mars 2026',
    city: 'Douala',
    score: '92%',
    status: 'done',
    statusLabel: 'Validé',
    collaboratorName: 'Momo Amand TCHOMBAM',
    collaboratorLevel: 'Diagnostic (Expert)',
    agency: 'Yaoundé',
    trainerName: 'Lucien GAGNE',
    trainerRole: 'Formateur Renault Trucks',
    trainerPhoto: '/assets/team/lucien-gagne.png',
    brandLogo: '/assets/logos/renault-trucks.png',
    brandLabel: 'Renault Trucks',
    img: '/assets/img_cards/formation_niveau_2_test_pratique.png',
    accentColor: '#1aab5b',
    details: {
      theme: 'Chaîne cinématique, embrayage robotisé & boîte Optidriver',
      brand: 'Renault Trucks',
      location: 'Centre CFAO Academy Douala',
      duration: '5 jours (35 heures)',
      trainer: 'Lucien GAGNE',
      evaluation: 'Très grande rigueur sur les procédures d’apprentissage embrayage et essais fonctionnels.',
      practicalScore: '92/100',
    },
  },
  {
    id: 'rep-hino-ebs-mube',
    brand: 'hino',
    title: 'Circuits de freinage pneumatique & ABS Hino séries 300 et 500 du 22 avril 2026',
    date: '22 avr. 2026',
    city: 'Douala',
    score: '88%',
    status: 'done',
    statusLabel: 'Validé',
    collaboratorName: 'Victor Aimé MUBE',
    collaboratorLevel: 'Réparation (Senior)',
    agency: 'Yaoundé',
    trainerName: 'Lucien GAGNE',
    trainerRole: 'Formateur Véhicules Industriels',
    trainerPhoto: '/assets/team/lucien-gagne.png',
    brandLogo: '/assets/logos/hino.png',
    brandLabel: 'Hino',
    img: '/assets/img_cards/equipment_niveau_2_test_pratique.png',
    accentColor: '#1aab5b',
    details: {
      theme: 'Circuits de freinage pneumatique & modulateurs ABS Hino',
      brand: 'Hino',
      location: 'Atelier CFAO Mobility Douala',
      duration: '4 jours (28 heures)',
      trainer: 'Lucien GAGNE',
      evaluation: 'Bonne autonomie sur la révision des valves de freinage et le diagnostic des capteurs de roue.',
      practicalScore: '88/100',
    },
  },
  {
    id: 'rep-tmh-forklift-mengou',
    brand: 'toyota-forklift',
    title: 'Maintenance hydraulique & mât d’élévation Chariots Toyota du 8 févr. 2026',
    date: '8 févr. 2026',
    city: 'Douala',
    score: '89%',
    status: 'done',
    statusLabel: 'Validé',
    collaboratorName: 'Ndoumbe Patrick Jose MENGOU',
    collaboratorLevel: 'Réparation (Senior)',
    agency: 'Yaoundé',
    trainerName: 'Thierry KOUGHA',
    trainerRole: 'Formateur certifié Manutention',
    trainerPhoto: '/assets/team/lucien-gagne.png',
    brandLogo: '/assets/logos/toyota-forklift.png',
    brandLabel: 'Toyota Material Handling',
    img: '/assets/img_cards/equipment_niveau_1_test_pratique.png',
    accentColor: '#1aab5b',
    details: {
      theme: 'Circuits hydrauliques, chaînes de mât & organes de levage',
      brand: 'Toyota Material Handling',
      location: 'Centre CFAO Academy Douala',
      duration: '4 jours (28 heures)',
      trainer: 'Thierry KOUGHA',
      evaluation: 'Parfaite maîtrise des vérins de levage et des contrôles de sécurité préventifs.',
      practicalScore: '89/100',
    },
  },
  {
    id: 'rep-kinglong-elec-ebomo',
    brand: 'king-long',
    title: 'Électricité multiplexée & Climatisation Bus King Long du 10 déc. 2025',
    date: '10 déc. 2025',
    city: 'Douala',
    score: '86%',
    status: 'done',
    statusLabel: 'Validé',
    collaboratorName: 'Paul Martin EBOMO',
    collaboratorLevel: 'Maintenance (Junior)',
    agency: 'Yaoundé',
    trainerName: 'Idris NKOA',
    trainerRole: 'Formateur Châssis & Bus',
    trainerPhoto: '/assets/team/idris-nkoa.png',
    brandLogo: '/assets/logos/kinglong.png',
    brandLabel: 'King Long',
    img: '/assets/img_cards/formation_niveau_1_test_pratique.png',
    accentColor: '#1aab5b',
    details: {
      theme: 'Réseaux de bord CAN, climatisation & compresseurs Bus',
      brand: 'King Long',
      location: 'Atelier CFAO Mobility Douala',
      duration: '3 jours (21 heures)',
      trainer: 'Idris NKOA',
      evaluation: 'Bonne méthode de contrôle des relais et lecture des schémas de câblage.',
      practicalScore: '86/100',
    },
  },
]

export default function ManagerFormationsSection({
  onOpenReport,
  id = 'formations',
}) {
  return (
    <PortalReveal id={id} as="section" className="portal-manager-formations-section">
      <div className="container" style={{ padding: '16px 32px' }}>
        <div className="portal-section-head">
          <PortalSectionEyebrow icon="book" label="RAPPORTS DE FORMATION" />
          <h2 className="portal-section-title">Formations effectuées par votre équipe</h2>
          <p className="portal-section-lead" style={{ margin: '6px 0 0 0', fontSize: '14.5px', lineHeight: 1.5 }}>
            Consultez les synthèses et évaluations pratiques validées par les formateurs agréés constructeur.
          </p>
        </div>

        <PortalStaggerGrid className="cols-3 pv-grid--stretch" style={{ marginTop: '24px' }}>
          {TEAM_TRAINING_REPORTS.map((rep) => (
            <div key={rep.id} id={`portal-card-${rep.id}`} className="portal-card-anchor">
              <PvCard
                className="pv-card--training-report"
                img={rep.img}
                logo={rep.brandLogo}
                kicker={
                  <span className="pv-card-kicker-row">
                    <span className="portal-status-chip done">{rep.statusLabel} · {rep.score}</span>
                  </span>
                }
                title={rep.title}
                meta={
                  <div className="portal-training-card-meta">
                    <div className="portal-training-collaborator-row" style={{ marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid rgba(26, 31, 60, 0.08)' }}>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted)', fontWeight: 600, display: 'block' }}>
                        Technicien formé
                      </span>
                      <strong style={{ fontSize: '13.5px', color: 'var(--ink)' }}>
                        {rep.collaboratorName}
                      </strong>
                      <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block' }}>
                        {rep.agency} · {rep.collaboratorLevel}
                      </span>
                    </div>

                    <div className="portal-training-trainer-row">
                      <img
                        src={rep.trainerPhoto}
                        alt={rep.trainerName}
                        className="portal-training-trainer-avatar"
                        loading="lazy"
                      />
                      <div className="portal-training-trainer-info">
                        <span className="portal-training-trainer-label">Formateur certifié</span>
                        <span className="portal-training-trainer-name">{rep.trainerName}</span>
                        <span className="portal-training-trainer-role">{rep.trainerRole}</span>
                      </div>
                    </div>
                  </div>
                }
                cta="Consulter le rapport"
                accentColor={rep.accentColor}
                onClick={() => onOpenReport?.(rep)}
                hoverHint="Consulter l'évaluation et le rapport"
                corner
              />
            </div>
          ))}
        </PortalStaggerGrid>
      </div>
    </PortalReveal>
  )
}
