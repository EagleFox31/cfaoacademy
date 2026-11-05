import { useMemo } from 'react'
import PageCloseButton from './PageCloseButton.jsx'
import PortalSectionEyebrow from './PortalSectionEyebrow.jsx'
import DetailHeaderLogos from './DetailHeaderLogos.jsx'
import DpsResultTierRow from './DpsResultTierRow.jsx'
import {
  resolveTeamgpElearningFilialeSummary,
  teamgpLevelChipClass,
} from '../utils/teamgpElearning.js'
import { evalScoreTierClass, evalScoreTier } from '../utils/learnerTests.js'
import { LOGO_CFAO_MOBILITY } from '../utils/resolveDetailCfaoLogo.js'
import { openTechnicianPifDetail } from '../utils/dpsTechnicianPifNavigation.js'
import { useNavigate } from 'react-router-dom'

const TEAMGP_LOGO = '/assets/logos/teamgp.png'
const TOYOTA_LOGO = '/assets/logos/toyota.png'

function formatLevelLabel(level, count, t) {
  const withCount = t.ki_elearning_level_with_count
  if (withCount) {
    return String(withCount)
      .replace('{level}', level)
      .replace('{count}', String(count))
  }
  return String(t.medacap_define_kpi_elearning_level ?? 'Niveau {level}')
    .replace('{level}', level)
}

function formatLastActivityDate(iso, locale = 'fr-FR') {
  if (!iso) return null
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function TrackFlagCell({ done, required, complete }) {
  if (done == null || required == null) {
    return (
      <td className="portal-teamgp-track-cell">
        <span className="portal-dps-brand-result-tier-score--pending">—</span>
      </td>
    )
  }

  const ratioClass = complete
    ? 'portal-teamgp-track-ratio portal-teamgp-track-ratio--ok'
    : 'portal-teamgp-track-ratio portal-teamgp-track-ratio--ko'

  return (
    <td className="portal-teamgp-track-cell">
      <span className={ratioClass}>
        {done}
        /
        {required}
      </span>
    </td>
  )
}

function TeamgpTechnicianRow({ tech, t, onOpenPif }) {
  const pctClass = tech.pct != null
    ? evalScoreTierClass(evalScoreTier(tech.pct))
    : 'portal-dps-brand-result-tier-score--pending'
  const lastActivity = formatLastActivityDate(tech.lastActivityAt)

  return (
    <tr>
      <td>
        <button
          type="button"
          className="portal-teamgp-tech-name-btn"
          onClick={(e) => onOpenPif(tech, e)}
        >
          {tech.name}
        </button>
        {tech.teamGpId ? (
          <span className="portal-teamgp-tech-id">{tech.teamGpId}</span>
        ) : null}
      </td>
      <td>
        <span className={teamgpLevelChipClass(tech.level)}>{tech.level}</span>
      </td>
      <td>
        {tech.targetLevel ? (
          <span className={teamgpLevelChipClass(tech.targetLevel, { next: true })}>
            {tech.targetLevel}
          </span>
        ) : (
          <span className="portal-teamgp-level-chip portal-teamgp-level-chip--top">—</span>
        )}
      </td>
      <TrackFlagCell
        done={tech.elearningDone}
        required={tech.elearningRequired}
        complete={tech.elearningComplete}
      />
      <TrackFlagCell
        done={tech.etestDone}
        required={tech.etestRequired}
        complete={tech.etestComplete}
      />
      <TrackFlagCell
        done={tech.practicalDone}
        required={tech.practicalRequired}
        complete={tech.practicalComplete}
      />
      <TrackFlagCell
        done={tech.othersDone}
        required={tech.othersRequired}
        complete={tech.othersComplete}
      />
      <td className="portal-teamgp-progress-cell">
        {tech.done != null && tech.required != null ? (
          <>
            <span className={`portal-dps-brand-result-tier-score ${pctClass}`}>
              {tech.pct != null ? `${Number(tech.pct).toFixed(1)}%` : '—'}
            </span>
            <span className="portal-teamgp-modules">
              {tech.done}
              /
              {tech.required}
              {' '}
              {t.ki_teamgp_modules_short}
            </span>
          </>
        ) : (
          <span className="portal-dps-brand-result-tier-score portal-dps-brand-result-tier-score--pending">
            {t.dps_results_brand_no_score}
          </span>
        )}
      </td>
      <td className="portal-teamgp-last-activity">
        {lastActivity ?? (
          <span className="portal-dps-brand-result-tier-score--pending">—</span>
        )}
      </td>
    </tr>
  )
}

/** Fiche détail filiale — évolution TEAM-GP (niveau actuel → next, avancement). */
export default function KiTeamgpDetailView({ shellRef, t, onBack }) {
  const navigate = useNavigate()
  const summary = useMemo(() => resolveTeamgpElearningFilialeSummary(), [])
  const pendingLabel = t.dps_results_brand_no_score

  const levelRows = (summary.levelOrder ?? [])
    .map(level => {
      const row = summary.byLevel?.[level]
      if (!row?.count) return null
      return (
        <DpsResultTierRow
          key={level}
          label={formatLevelLabel(level, row.count, t)}
          score={row.avgPct}
          pendingLabel={pendingLabel}
        />
      )
    })
    .filter(Boolean)

  function handleOpenPif(tech, event) {
    openTechnicianPifDetail(navigate, { id: tech.id, name: tech.name }, event)
  }

  return (
    <div ref={shellRef} className="portal-brand-detail-shell">
      <div className="container article-shell portal-dps-brand-shell">
        <PageCloseButton
          onClick={onBack}
          ariaLabel={t.ki_teamgp_detail_close}
        />

        <div className="article-main">
          <article className="article-sheet portal-dps-brand-sheet portal-teamgp-detail-sheet">
            <header className="article-header portal-dps-brand-header">
              <DetailHeaderLogos
                cfaoLogo={LOGO_CFAO_MOBILITY}
                brandLogo={TEAMGP_LOGO}
                brandLabel="TEAM-GP"
                brandId="teamgp"
                trailingLogo={TOYOTA_LOGO}
                trailingBrandId="toyota"
              />

              <div className="portal-dps-brand-header-intro">
                <PortalSectionEyebrow icon="award" label={t.ki_teamgp_detail_eyebrow} />
                <h1>{t.ki_teamgp_detail_title}</h1>
                <p className="article-lead portal-dps-brand-detail-sub">
                  {String(t.ki_teamgp_detail_lead ?? '')
                    .replace('{count}', String(summary.linkedCount))}
                </p>
              </div>

              <div className="portal-dps-brand-header-summary">
                <div className="portal-dps-brand-result-meta portal-dps-brand-detail-summary">
                  <div className="portal-dps-brand-result-tiers">
                    {levelRows}
                    <DpsResultTierRow
                      label={t.ki_elearning_card_rate_label}
                      score={summary.avgPct}
                      pendingLabel={pendingLabel}
                      isGlobal
                    />
                  </div>
                </div>
              </div>
            </header>

            <div className="portal-dps-brand-sheet-body">
              {summary.technicians?.length ? (
                <div className="portal-teamgp-table-wrap">
                  <table className="portal-table portal-teamgp-table">
                    <thead>
                      <tr>
                        <th scope="col">{t.ki_teamgp_col_technician}</th>
                        <th scope="col">{t.ki_teamgp_col_current}</th>
                        <th scope="col">{t.ki_teamgp_col_target}</th>
                        <th scope="col" className="portal-teamgp-track-col">{t.ki_teamgp_col_elearning}</th>
                        <th scope="col" className="portal-teamgp-track-col">{t.ki_teamgp_col_etest}</th>
                        <th scope="col" className="portal-teamgp-track-col">{t.ki_teamgp_col_practical}</th>
                        <th scope="col" className="portal-teamgp-track-col">{t.ki_teamgp_col_others}</th>
                        <th scope="col">{t.ki_teamgp_col_progress}</th>
                        <th scope="col">{t.ki_teamgp_col_last_activity}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.technicians.map(tech => (
                        <TeamgpTechnicianRow
                          key={tech.id}
                          tech={tech}
                          t={t}
                          onOpenPif={handleOpenPif}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="portal-morph-empty portal-dps-brand-empty">
                  {t.ki_teamgp_detail_empty}
                </p>
              )}
            </div>
          </article>
        </div>
      </div>
    </div>
  )
}
