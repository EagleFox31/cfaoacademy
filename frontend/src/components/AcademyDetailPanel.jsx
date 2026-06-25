import useLocale from '../hooks/useLocale.js'
import { localizeAcademyPillar } from '../utils/localizeAcademy.js'

export default function AcademyDetailPanel({ pillar, onBack }) {
  const { locale, t: uiT } = useLocale('academyUi')
  const localized = localizeAcademyPillar(pillar, locale)
  if (!localized) return null

  return (
    <article
      className="academy-detail"
      id={`academy-detail-${localized.id}`}
      aria-labelledby={`academy-detail-title-${localized.id}`}
    >
      {onBack && (
        <button
          type="button"
          className="academy-detail-close"
          onClick={onBack}
          aria-label={uiT.closePanels}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      )}
      <figure className="academy-detail-media">
        <img src={localized.image} alt={localized.imageAlt ?? ''} loading="lazy" />
      </figure>
      <div className="academy-detail-body">
        <p className="academy-detail-kicker">{localized.kicker}</p>
        {localized.panelIx && <p className="academy-detail-ix">{localized.panelIx}</p>}
        <h3 className="academy-detail-title" id={`academy-detail-title-${localized.id}`}>
          {localized.panelTitle ?? localized.title}
        </h3>
        <p className="academy-detail-lead">{localized.lead}</p>
        {localized.paragraphs.map((text, i) => (
          <p key={i}>{text}</p>
        ))}
      </div>
    </article>
  )
}
