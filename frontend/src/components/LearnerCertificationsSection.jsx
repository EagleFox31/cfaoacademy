import PortalSectionEyebrow from './PortalSectionEyebrow.jsx'
import PortalReveal from './PortalReveal.jsx'
import PortalStaggerGrid from './PortalStaggerGrid.jsx'
import PvCard from './PvCard.jsx'

const DEFAULT_CERTIFICATIONS = [
  {
    id: 'cert-rt-maint',
    brand: 'renault-trucks',
    title: 'Certification Renault Trucks · Maintenance',
    level: 'Maintenance',
    date: '15 janv. 2025',
    certId: 'RT-MAINT-2025-042',
    brandLogo: '/assets/logos/renault-trucks.png',
    brandLabel: 'Renault Trucks',
    img: '/assets/img_cards/certification.jpg',
    accentColor: '#1aab5b',
  },
  {
    id: 'cert-sino-maint',
    brand: 'sinotruk',
    title: 'Certification Sinotruk · Maintenance',
    level: 'Maintenance',
    date: '10 nov. 2024',
    certId: 'SINO-MAINT-2024-019',
    brandLogo: '/assets/logos/sinotruk.png',
    brandLabel: 'Sinotruk',
    img: '/assets/img_cards/certification.jpg',
    accentColor: '#1aab5b',
  },
]

export default function LearnerCertificationsSection({
  user,
  lms,
  t,
  onOpenCert,
  id = 'certifications',
}) {
  const rawCerts = lms?.certifications?.length ? lms.certifications : DEFAULT_CERTIFICATIONS
  const certifications = rawCerts
    .filter(c => {
      const txt = `${c.title ?? ''} ${c.level ?? ''} ${c.id ?? ''}`.toLowerCase()
      return !txt.includes('senior')
    })
    .map(c => {
      const cleanTitle = (c.title ?? '')
        .replace(/\s*\(Niveau\s*1\)/gi, '')
        .replace(/\s*Niveau\s*1/gi, '')
        .trim()
      const cleanLevel = (c.level ?? '')
        .replace(/Niveau\s*1\s*·?\s*/gi, '')
        .replace(/\s*\(Niveau\s*1\)/gi, '')
        .trim()
      return {
        ...c,
        title: cleanTitle,
        level: cleanLevel || 'Maintenance',
        img: c.img || '/assets/img_cards/certification.jpg',
        brandLogo: c.brandLogo || (c.brand === 'sinotruk' ? '/assets/logos/sinotruk.png' : '/assets/logos/renault-trucks.png'),
        brandLabel: c.brandLabel || (c.brand === 'sinotruk' ? 'Sinotruk' : 'Renault Trucks'),
      }
    })

  return (
    <PortalReveal id={id}>
      <div className="container" style={{ padding: '16px 32px' }}>
        <div className="portal-section-head">
          <PortalSectionEyebrow icon="award" label="Reconnaissance constructeur" />
          <h2 className="portal-section-title">Mes Certifications</h2>
        </div>

        <PortalStaggerGrid className="cols-4 pv-grid--stretch">
          {certifications.map((c) => (
            <div key={c.id} id={`portal-card-${c.id}`} className="portal-card-anchor">
              <PvCard
                className="pv-card--cert"
                img={c.img}
                logo={c.brandLogo}
                brandLabel={c.brandLabel}
                kicker={<span className="portal-status-chip done">Certifié</span>}
                title={c.title}
                meta={
                  <div className="portal-cert-card-meta">
                    {c.level && !c.title?.toLowerCase().includes(c.level.toLowerCase()) && (
                      <p style={{ margin: 0, fontWeight: 600, color: 'var(--ink, #0e1126)' }}>{c.level}</p>
                    )}
                    <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: 'var(--muted, #64748b)' }}>
                      Obtenue le {c.date} · N° {c.certId}
                    </p>
                  </div>
                }
                cta="Télécharger l'attestation"
                accentColor={c.accentColor || '#1aab5b'}
                onClick={() => onOpenCert?.(c)}
                hoverHint="Voir et télécharger l'attestation"
                corner
              />
            </div>
          ))}
        </PortalStaggerGrid>
      </div>
    </PortalReveal>
  )
}
