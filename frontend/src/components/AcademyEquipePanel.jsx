import { Fragment, useMemo, useState } from 'react'
import AcademyTeamPerson from './AcademyTeamPerson.jsx'
import equipePoles from '../data/academy/equipe-poles.json'
import useLocale from '../hooks/useLocale.js'
import {
  localizeAcademyPillar,
  localizeEquipePole,
  localizeTeamMember,
} from '../utils/localizeAcademy.js'

export default function AcademyEquipePanel({ data, onBack }) {
  const { locale, t: uiT } = useLocale('academyUi')
  const localizedData = localizeAcademyPillar(data, locale)
  const poles = useMemo(
    () => equipePoles.poles.map((p) => localizeEquipePole(p, locale)),
    [locale],
  )
  const [activePoleId, setActivePoleId] = useState(poles[0]?.id ?? null)

  if (!localizedData) return null

  const activePole = poles.find((p) => p.id === activePoleId) ?? poles[0]

  return (
    <article className="academy-equipe" aria-labelledby="academy-equipe-title">
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

      <div className="academy-equipe-grid">
        <aside className="academy-equipe-poles-card" aria-label={uiT.polesNavAria}>
          <p className="academy-equipe-poles-kicker">{uiT.polesKicker}</p>
          <nav className="academy-equipe-poles-nav">
            {poles.map((pole) => (
              <Fragment key={pole.id}>
                <button
                  type="button"
                  className={`academy-equipe-pole-btn${pole.id === 'supports' ? ' academy-equipe-pole-btn--supports' : ''}${activePole?.id === pole.id ? ' is-active' : ''}`}
                  aria-current={activePole?.id === pole.id ? 'true' : undefined}
                  onClick={() => setActivePoleId(pole.id)}
                >
                  <span className="academy-equipe-pole-btn-label">{pole.shortLabel}</span>
                  <span className="academy-equipe-pole-btn-count">{pole.members.length}</span>
                </button>
                {pole.id === 'supports' && (
                  <div className="academy-equipe-poles-divider" role="separator" aria-hidden="true" />
                )}
              </Fragment>
            ))}
          </nav>
        </aside>

        <div className="academy-equipe-members-card" aria-live="polite">
          <header className="academy-equipe-head">
            {localizedData.panelIx && <p className="academy-equipe-ix">{localizedData.panelIx}</p>}
            <h3 className="academy-equipe-title" id="academy-equipe-title">
              {localizedData.panelTitle ?? localizedData.title}
            </h3>
            {localizedData.lead && <p className="academy-equipe-lead">{localizedData.lead}</p>}
          </header>

          {activePole && (
            <>
              <h4 className="academy-equipe-pole-label">{activePole.label}</h4>
              <div className="academy-equipe-members-list">
                {activePole.members.map((person) => (
                  <AcademyTeamPerson
                    key={`${activePole.id}-${person.name}`}
                    {...localizeTeamMember(person, locale)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </article>
  )
}
