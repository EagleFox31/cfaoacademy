import { evalScoreTier, evalScoreTierClass } from '../utils/learnerTests.js'

function formatScorePct(score) {
  return `${score}%`
}

export default function DpsResultTierRow({ label, score, pendingLabel, scoreTitle, isGlobal = false }) {
  const tier = score != null ? evalScoreTier(score) : null

  return (
    <div className={`portal-dps-brand-result-tier${isGlobal ? ' portal-dps-brand-result-tier--global' : ''}`}>
      <span className="portal-dps-brand-result-tier-label">{label}</span>
      {score != null ? (
        <span
          className={[
            'portal-dps-brand-result-tier-score',
            evalScoreTierClass(tier),
            scoreTitle && 'portal-dps-brand-result-tier-score--hint',
          ].filter(Boolean).join(' ')}
          title={scoreTitle || undefined}
        >
          {formatScorePct(score)}
        </span>
      ) : (
        <span className="portal-dps-brand-result-tier-score portal-dps-brand-result-tier-score--pending">
          {pendingLabel}
        </span>
      )}
    </div>
  )
}
