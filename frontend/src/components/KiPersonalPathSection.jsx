import PortalSectionEyebrow from './PortalSectionEyebrow.jsx'
import PortalSessionCard from './PortalSessionCard.jsx'
import PvCard from './PvCard.jsx'
import { portalPvCardMedia } from '../utils/portalCardMedia.js'
import { buildFormationFicheTo } from '../utils/sessionsReturn.js'
import { planningSessionAccent } from '../utils/learnerPlanning.js'
import { teamgpLevelChipClass } from '../utils/teamgpElearning.js'

/**
 * Parcours personnel KI — cards Toyota restantes (niveau actuel → G1).
 * Date si session Academy planifiée ; CTA s’inscrire si pas encore inscrit.
 */
export default function KiPersonalPathSection({ path, t, onEnroll }) {
  return (
    <section id="parcours" className="portal-ki-personal-path">
      <div className="container">
        <div className="portal-section-head">
          <PortalSectionEyebrow icon="milestone" label={t.ki_path_eyebrow} />
          <h2 className="portal-section-title">
            {t.ki_path_title.replace(
              '{level}',
              path.remainingLevels[0] ?? path.currentLevel ?? 'G1',
            )}
          </h2>
          {path.currentLevel && !path.complete && (
            <p className="portal-section-lead portal-ki-path-lead">
              <span>{t.ki_path_desc_you_are}</span>
              <span className={teamgpLevelChipClass(path.currentLevel)}>
                {path.currentLevel}
              </span>
              <span className="portal-ki-path-lead-arrow" aria-hidden="true">→</span>
              <span>{t.ki_path_desc_remaining}</span>
              {path.remainingLevels.map((level) => (
                <span
                  key={level}
                  className={teamgpLevelChipClass(level, { next: true })}
                >
                  {level}
                </span>
              ))}
            </p>
          )}
        </div>

        {path.complete ? (
          <p className="portal-morph-empty" role="status">{t.ki_path_complete}</p>
        ) : path.items.length === 0 ? (
          <p className="portal-morph-empty" role="status">{t.ki_path_empty}</p>
        ) : (
          <div className="pv-grid cols-4 pv-grid--stretch">
            {path.items.map((item) => (
              <KiPathCard
                key={item.id}
                item={item}
                t={t}
                onEnroll={() => onEnroll?.(item)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function KiPathCard({ item, t, onEnroll }) {
  if (item.session) {
    const canEnroll = item.annualStatus === 'a_inscrire'
    return (
      <div className="portal-card-anchor" id={`portal-card-${item.id}`}>
        <PortalSessionCard
          session={item.session}
          annualStatus={item.annualStatus}
          t={t}
          planMode
          showSessionDate
          accentColor={item.accentColor}
          cta={canEnroll ? t.ki_path_enroll : t.card_view_formation_detail}
          hoverHint={canEnroll ? t.ki_path_enroll_hint : t.card_view_detail}
          onClick={canEnroll ? onEnroll : undefined}
        />
      </div>
    )
  }

  const media = portalPvCardMedia({
    code: item.code,
    brand: item.brand,
    modality: 'presentiel',
  })
  const ficheTo = buildFormationFicheTo({ code: item.code, marque: 'TOYOTA' })

  return (
    <div className="portal-card-anchor" id={`portal-card-${item.id}`}>
      <PvCard
        {...media}
        kicker={(
          <span className="portal-status-chip annual_a_programmer">
            {t.ki_path_unscheduled}
          </span>
        )}
        title={item.title}
        meta={`${item.level} · ${item.code}`}
        cta={t.card_view_formation_detail}
        accentColor={planningSessionAccent('a_programmer')}
        hoverHint={t.card_view_detail}
        to={ficheTo}
        corner
      />
    </div>
  )
}
