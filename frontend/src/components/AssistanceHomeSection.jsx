import PreviewSection from './PreviewSection.jsx'
import PvCardGrid from './PvCardGrid.jsx'
import PvCard from './PvCard.jsx'
import AssistanceMediaIcon from './AssistanceMediaIcon.jsx'
import useLocale from '../hooks/useLocale.js'
import { sectionTitle } from '../utils/sectionTitle.jsx'

/**
 * Section · ASSISTANCE TECHNIQUE sur la landing page.
 * Présente la carte compacte pour parler à un expert marque.
 */
export default function AssistanceHomeSection() {
  const { t: homeT } = useLocale('home')

  const titleBefore = homeT.assistanceTitleBefore ?? 'Assistance '
  const titleEm = homeT.assistanceTitleEm ?? 'Technique'
  const titleAfter = homeT.assistanceTitleAfter ?? '.'

  return (
    <PreviewSection
      id="assistance"
      ix={homeT.assistanceIx ?? 'Support Expert'}
      title={sectionTitle(titleBefore, titleEm, titleAfter)}
      headClass="pv-head--compact-line"
      bgWord="support"
      bgWordSide="right"
      sectionVeil="dark"
    >
      <PvCardGrid single className="pv-card-grid--assistance">
        <PvCard
          to="/portail/assistance"
          cardMedia={(
            <div className="pv-card-img" style={{ position: 'relative' }}>
              <img
                src="/assets/technicien-travaillant.png"
                alt="Technicien CFAO"
                loading="lazy"
              />
              <AssistanceMediaIcon />
            </div>
          )}
          kicker="SUPPORT TECHNIQUE"
          title={(
            <>
              Besoin d'aide ?
              <br />
              Parler à un expert
            </>
          )}
          meta="Obtenez de l'aide auprès d'un expert marque"
          cta={homeT.assistanceCta ?? "Parler à un expert"}
          hoverHint={homeT.assistanceCta ?? "Parler à un expert"}
          accentColor="var(--red)"
          corner
        />
      </PvCardGrid>
    </PreviewSection>
  )
}
