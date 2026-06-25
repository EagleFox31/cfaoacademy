import SitePageLayout from '../components/SitePageLayout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import AcademyDetailPanel from '../components/AcademyDetailPanel.jsx'
import AcademyMedacapPanel from '../components/AcademyMedacapPanel.jsx'
import AcademyEquipePanel from '../components/AcademyEquipePanel.jsx'
import AcademyPaysPanel from '../components/AcademyPaysPanel.jsx'
import { ACADEMY_PILLARS } from '../data/academy/index.js'
import { localizeAcademyPillar } from '../utils/localizeAcademy.js'
import useLocale from '../hooks/useLocale.js'

function PillarSection({ pillar }) {
  const { locale } = useLocale('common')
  const loc = localizeAcademyPillar(pillar, locale)
  const kicker = loc?.kicker ?? pillar.kicker
  const title = loc?.panelTitle ?? loc?.title ?? pillar.panelTitle ?? pillar.title

  const content =
    pillar.id === 'medacap' ? (
      <AcademyMedacapPanel data={pillar} />
    ) : pillar.id === 'equipe' ? (
      <AcademyEquipePanel data={pillar} />
    ) : pillar.id === 'pays' ? (
      <AcademyPaysPanel data={pillar} />
    ) : (
      <AcademyDetailPanel pillar={pillar} />
    )

  return (
    <section className="apropos-section">
      <div className="container">
        <div className="apropos-section-head">
          {kicker && <p className="eyebrow">{kicker}</p>}
          {title && <h2 className="apropos-section-title">{title}</h2>}
        </div>
        {content}
      </div>
    </section>
  )
}

export default function APropos() {
  return (
    <SitePageLayout>
      <main>
        <PageHeader
          eyebrow="CFAO Academy"
          title="À propos"
          sub="Notre mission, notre équipe, notre réseau — la formation technique au cœur de la mobilité africaine."
        />
        {ACADEMY_PILLARS.map((pillar) => (
          <PillarSection key={pillar.id} pillar={pillar} />
        ))}
      </main>
    </SitePageLayout>
  )
}
