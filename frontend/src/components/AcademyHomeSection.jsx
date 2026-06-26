import { useCallback, useState } from 'react'
import PreviewSection from './PreviewSection.jsx'
import PvCardGrid from './PvCardGrid.jsx'
import PvCard from './PvCard.jsx'
import AcademyMedacapPanel from './AcademyMedacapPanel.jsx'
import AcademyEquipePanel from './AcademyEquipePanel.jsx'
import AcademyPaysPanel from './AcademyPaysPanel.jsx'
import AcademyDetailPanel from './AcademyDetailPanel.jsx'
import { ACADEMY_PREVIEW, getAcademyPillar } from '../data/academy/index.js'
import useLocale from '../hooks/useLocale.js'
import { localizedAcademyPreview } from '../utils/localizeCard.js'
import { sectionTitle } from '../utils/sectionTitle.jsx'

export default function AcademyHomeSection() {
  const [openId, setOpenId] = useState(null)
  const { t: homeT } = useLocale('home')
  const { locale, t: commonT } = useLocale('common')

  const openPillar = useCallback((tabId) => {
    setOpenId(tabId)
  }, [])

  const backToGrid = useCallback(() => {
    setOpenId(null)
  }, [])

  const pillar = openId ? getAcademyPillar(openId) : null

  return (
    <PreviewSection
      id="expertise"
      ix={homeT.academyIx}
      title={sectionTitle(homeT.academyTitleBefore, homeT.academyTitleEm, homeT.academyTitleAfter)}
      headClass="pv-head--compact-line"
      bgWord="academy"
      bgWordSide="left"
    >
      {!openId ? (
        <PvCardGrid className="pv-card-grid--expertise">
          {ACADEMY_PREVIEW.map((a) => {
            const card = localizedAcademyPreview(a, locale)
            return (
            <PvCard
              key={a.tab}
              kicker={card.kicker}
              title={card.title}
              meta={card.meta}
              img={card.image}
              corner
              onClick={() => openPillar(a.tab)}
              hoverHint={commonT.learnMore}
            />
            )
          })}
        </PvCardGrid>
      ) : pillar?.id === 'medacap' ? (
        <AcademyMedacapPanel data={pillar} onBack={backToGrid} />
      ) : pillar?.id === 'equipe' ? (
        <AcademyEquipePanel data={pillar} onBack={backToGrid} />
      ) : pillar?.id === 'pays' ? (
        <AcademyPaysPanel data={pillar} onBack={backToGrid} />
      ) : pillar ? (
        <AcademyDetailPanel pillar={pillar} onBack={backToGrid} />
      ) : null}
    </PreviewSection>
  )
}
