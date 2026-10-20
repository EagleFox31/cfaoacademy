import { useMemo, useState } from 'react'
import PortalSectionEyebrow from './PortalSectionEyebrow.jsx'
import PortalReveal from './PortalReveal.jsx'
import PortalStaggerGrid from './PortalStaggerGrid.jsx'
import PvCard from './PvCard.jsx'
import ChipFilterBar from './ChipFilterBar.jsx'

export const TEAM_CERTIFICATIONS = [
  {
    id: 'cert-lovol-maint',
    brand: 'lovol',
    brandSlug: 'lovol',
    title: 'Certification Lovol · Maintenance',
    tierKey: 'junior',
    level: 'Maintenance',
    date: '14 mai 2026',
    certId: 'LVL-MAINT-2026-011',
    brandLogo: '/assets/logos/lovol.png',
    brandLabel: 'Lovol',
    img: '/assets/img_cards/certification.jpg',
    accentColor: '#1a56db',
    certifiedCount: 2,
    technicians: [
      { name: 'Achille Patrick NJIKE KAPNANG', level: 'Maintenance', agency: 'Yaoundé', date: '14 mai 2026' },
      { name: 'Ndoumbe Patrick Jose MENGOU', level: 'Maintenance', agency: 'Yaoundé', date: '14 mai 2026' },
    ],
  },
  {
    id: 'cert-hino-maint',
    brand: 'hino',
    brandSlug: 'hino',
    title: 'Certification Hino · Maintenance',
    tierKey: 'junior',
    level: 'Maintenance',
    date: '15 janv. 2025',
    certId: 'HINO-MAINT-2025-042',
    brandLogo: '/assets/logos/hino.png',
    brandLabel: 'Hino',
    img: '/assets/img_cards/certification.jpg',
    accentColor: '#1a56db',
    certifiedCount: 3,
    technicians: [
      { name: 'Paul Martin EBOMO', level: 'Maintenance', agency: 'Yaoundé', date: '15 janv. 2025' },
      { name: 'Gabriel Alain NGAKO POUASSI', level: 'Maintenance', agency: 'Yaoundé', date: '15 janv. 2025' },
      { name: 'Achille Patrick NJIKE KAPNANG', level: 'Maintenance', agency: 'Yaoundé', date: '15 janv. 2025' },
    ],
  },
  {
    id: 'cert-sino-maint',
    brand: 'sinotruk',
    brandSlug: 'sinotruk',
    title: 'Certification Sinotruk · Maintenance',
    tierKey: 'junior',
    level: 'Maintenance',
    date: '10 nov. 2024',
    certId: 'SINO-MAINT-2024-019',
    brandLogo: '/assets/logos/sinotruk.png',
    brandLabel: 'Sinotruk',
    img: '/assets/img_cards/certification.jpg',
    accentColor: '#1a56db',
    certifiedCount: 4,
    technicians: [
      { name: 'Ntep IBRAHIM', level: 'Maintenance', agency: 'Yaoundé', date: '10 nov. 2024' },
      { name: 'Wa Ngoy Abraham NGOY', level: 'Maintenance', agency: 'Yaoundé', date: '10 nov. 2024' },
      { name: 'Gabriel Alain NGAKO POUASSI', level: 'Maintenance', agency: 'Yaoundé', date: '10 nov. 2024' },
      { name: 'Paul Martin EBOMO', level: 'Maintenance', agency: 'Yaoundé', date: '10 nov. 2024' },
    ],
  },
  {
    id: 'cert-jcb-maint',
    brand: 'jcb',
    brandSlug: 'jcb',
    title: 'Certification JCB · Maintenance',
    tierKey: 'junior',
    level: 'Maintenance',
    date: '20 févr. 2026',
    certId: 'JCB-MAINT-2026-008',
    brandLogo: '/assets/logos/jcb.png',
    brandLabel: 'JCB',
    img: '/assets/img_cards/certification.jpg',
    accentColor: '#1a56db',
    certifiedCount: 1,
    technicians: [
      { name: 'Achille Patrick NJIKE KAPNANG', level: 'Maintenance', agency: 'Yaoundé', date: '20 févr. 2026' },
    ],
  },
  {
    id: 'cert-rt-rep',
    brand: 'renault-trucks',
    brandSlug: 'renault-trucks',
    title: 'Certification Renault Trucks · Réparation',
    tierKey: 'senior',
    level: 'Réparation',
    date: '18 mars 2025',
    certId: 'RT-REP-2025-031',
    brandLogo: '/assets/logos/renault-trucks.png',
    brandLabel: 'Renault Trucks',
    img: '/assets/img_cards/certification.jpg',
    accentColor: '#e67e00',
    certifiedCount: 3,
    technicians: [
      { name: 'Marc Aurele IMOMA BATASSI', level: 'Réparation', agency: 'Yaoundé', date: '18 mars 2025' },
      { name: 'Kagnia Boris YIMGA', level: 'Réparation', agency: 'Yaoundé', date: '18 mars 2025' },
      { name: 'Victor Aimé MUBE', level: 'Réparation', agency: 'Yaoundé', date: '18 mars 2025' },
    ],
  },
  {
    id: 'cert-sino-rep',
    brand: 'sinotruk',
    brandSlug: 'sinotruk',
    title: 'Certification Sinotruk · Réparation',
    tierKey: 'senior',
    level: 'Réparation',
    date: '5 oct. 2025',
    certId: 'SINO-REP-2025-055',
    brandLogo: '/assets/logos/sinotruk.png',
    brandLabel: 'Sinotruk',
    img: '/assets/img_cards/certification.jpg',
    accentColor: '#e67e00',
    certifiedCount: 3,
    technicians: [
      { name: 'Lemoupa Alain TCHINDA', level: 'Réparation', agency: 'Yaoundé', date: '5 oct. 2025' },
      { name: 'Victor Aimé MUBE', level: 'Réparation', agency: 'Yaoundé', date: '5 oct. 2025' },
      { name: 'Marc Aurele IMOMA BATASSI', level: 'Réparation', agency: 'Yaoundé', date: '5 oct. 2025' },
    ],
  },
  {
    id: 'cert-tmh-rep',
    brand: 'toyota-forklift',
    brandSlug: 'toyota-forklift',
    title: 'Certification Toyota Material · Réparation',
    tierKey: 'senior',
    level: 'Réparation',
    date: '8 févr. 2026',
    certId: 'TMH-REP-2026-014',
    brandLogo: '/assets/logos/toyota-forklift.png',
    brandLabel: 'Toyota Material Handling',
    img: '/assets/img_cards/certification.jpg',
    accentColor: '#e67e00',
    certifiedCount: 2,
    technicians: [
      { name: 'Ndoumbe Patrick Jose MENGOU', level: 'Réparation', agency: 'Yaoundé', date: '8 févr. 2026' },
      { name: 'Achille Patrick NJIKE KAPNANG', level: 'Réparation', agency: 'Yaoundé', date: '8 févr. 2026' },
    ],
  },
  {
    id: 'cert-rt-diag',
    brand: 'renault-trucks',
    brandSlug: 'renault-trucks',
    title: 'Certification Renault Trucks · Diagnostic',
    tierKey: 'expert',
    level: 'Diagnostic',
    date: '12 nov. 2025',
    certId: 'RT-DIAG-2025-007',
    brandLogo: '/assets/logos/renault-trucks.png',
    brandLabel: 'Renault Trucks',
    img: '/assets/img_cards/certification.jpg',
    accentColor: '#1aab5b',
    certifiedCount: 2,
    technicians: [
      { name: 'Momo Amand TCHOMBAM', level: 'Diagnostic', agency: 'Yaoundé', date: '12 nov. 2025' },
      { name: 'Michel BAYEMI', level: 'Diagnostic', agency: 'Yaoundé', date: '12 nov. 2025' },
    ],
  },
  {
    id: 'cert-hino-diag',
    brand: 'hino',
    brandSlug: 'hino',
    title: 'Certification Hino · Diagnostic',
    tierKey: 'expert',
    level: 'Diagnostic',
    date: '2 déc. 2025',
    certId: 'HINO-DIAG-2025-012',
    brandLogo: '/assets/logos/hino.png',
    brandLabel: 'Hino',
    img: '/assets/img_cards/certification.jpg',
    accentColor: '#1aab5b',
    certifiedCount: 2,
    technicians: [
      { name: 'Michel BAYEMI', level: 'Diagnostic', agency: 'Yaoundé', date: '2 déc. 2025' },
      { name: 'Momo Amand TCHOMBAM', level: 'Diagnostic', agency: 'Yaoundé', date: '2 déc. 2025' },
    ],
  },
]

const TIER_OPTIONS = [
  { id: 'all',    label: 'Toutes' },
  { id: 'junior', label: 'Maintenance' },
  { id: 'senior', label: 'Réparation' },
  { id: 'expert', label: 'Diagnostic' },
]

export default function ManagerCertificationsSection({
  onOpenCert,
  id = 'certifications',
}) {
  const [activeTier, setActiveTier] = useState('all')

  const tierCounts = useMemo(() => {
    const counts = { all: TEAM_CERTIFICATIONS.length, junior: 0, senior: 0, expert: 0 }
    for (const cert of TEAM_CERTIFICATIONS) {
      if (counts[cert.tierKey] != null) counts[cert.tierKey] += 1
    }
    return counts
  }, [])

  const filterOptions = useMemo(
    () => TIER_OPTIONS.map(opt => ({
      id: opt.id,
      label: opt.label,
      count: tierCounts[opt.id] ?? 0,
    })),
    [tierCounts],
  )

  const visibleCertifications = useMemo(() => {
    if (activeTier === 'all') return TEAM_CERTIFICATIONS
    return TEAM_CERTIFICATIONS.filter(c => c.tierKey === activeTier)
  }, [activeTier])

  return (
    <PortalReveal id={id} as="section" className="portal-manager-certifications-section">
      <div className="container" style={{ padding: '16px 32px' }}>
        <div className="portal-section-head">
          <PortalSectionEyebrow icon="award" label="RECONNAISSANCE CONSTRUCTEUR" />
          <h2 className="portal-section-title">Certifications constructeur de votre équipe</h2>
          <p className="portal-section-lead" style={{ margin: '6px 0 0 0', fontSize: '14px', color: 'var(--muted)' }}>
            Suivi des certifications officielles par marque et palier MEDACAP obtenues par vos collaborateurs.
          </p>
        </div>

        <ChipFilterBar
          portal
          label="FILTRER"
          ariaLabel="Filtrer les certifications par palier MEDACAP"
          value={activeTier}
          onChange={setActiveTier}
          options={filterOptions}
        />

        <PortalStaggerGrid className="cols-3 pv-grid--stretch">
          {visibleCertifications.map((c) => (
            <div key={c.id} id={`portal-card-${c.id}`} className="portal-card-anchor">
              <PvCard
                className="pv-card--cert"
                img={c.img}
                logo={c.brandLogo}
                brandLabel={c.brandLabel}
                kicker={
                  <span className="portal-status-chip done">
                    {c.certifiedCount} {c.certifiedCount > 1 ? 'techniciens certifiés' : 'technicien certifié'}
                  </span>
                }
                title={c.title}
                meta={
                  <div className="portal-cert-card-meta">
                    <p style={{ margin: 0, fontWeight: 600, color: 'var(--ink, #0e1126)' }}>
                      Palier {c.level}
                    </p>
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--muted, #64748b)' }}>
                      {c.technicians.map(t => t.name).slice(0, 2).join(', ')}
                      {c.technicians.length > 2 ? ` + ${c.technicians.length - 2} autre` : ''}
                    </p>
                    <p style={{ margin: '4px 0 0 0', fontSize: '11.5px', color: 'var(--muted, #64748b)' }}>
                      Promotion {c.date.slice(-4)} · N° {c.certId}
                    </p>
                  </div>
                }
                cta="Consulter les certifications"
                accentColor={c.accentColor || '#1aab5b'}
                onClick={() => onOpenCert?.(c)}
                hoverHint="Voir le détail et les attestations"
                corner
              />
            </div>
          ))}
        </PortalStaggerGrid>
      </div>
    </PortalReveal>
  )
}
