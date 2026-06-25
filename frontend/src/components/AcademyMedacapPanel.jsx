import useLocale from '../hooks/useLocale.js'
import { localizeAcademyPillar } from '../utils/localizeAcademy.js'

export default function AcademyMedacapPanel({ data, onBack }) {
  const { locale, t: uiT } = useLocale('academyUi')
  const localized = localizeAcademyPillar(data, locale)
  if (!localized) return null

  const cycleSrc = localized.cycleImage ?? localized.image

  return (
    <article className="academy-medacap" aria-labelledby="academy-medacap-title">
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
      <div className="academy-medacap-grid">
        <figure className="academy-medacap-cycle">
          <img src={cycleSrc} alt={localized.imageAlt ?? ''} loading="lazy" />
        </figure>

        <div className="academy-medacap-card">
          <p className="academy-medacap-eyebrow">{localized.eyebrow}</p>
          <h3 className="academy-medacap-title" id="academy-medacap-title">
            {localized.title}
          </h3>
          <p className="academy-medacap-lead">{localized.lead}</p>

          <ul className="academy-medacap-steps">
            {(localized.steps ?? []).map((step) => (
              <li key={step.num} className="academy-medacap-step">
                <span className="academy-medacap-step-num">{step.num}</span>
                <span className="academy-medacap-step-text">
                  <strong>{step.verb}</strong>
                  <span>{step.desc}</span>
                </span>
              </li>
            ))}
          </ul>

          {(localized.paragraphs ?? []).map((text, i) => (
            <p key={i} className="academy-medacap-note">{text}</p>
          ))}
        </div>
      </div>
    </article>
  )
}
