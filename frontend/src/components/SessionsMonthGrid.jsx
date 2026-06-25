import SessionCard from './SessionCard.jsx'
import useLocale from '../hooks/useLocale.js'

function monthGroupKey(dateStr) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${d.getMonth()}`
}

/** Regroupe des sessions triées par date, par mois calendaire. */
export function groupSessionsByMonth(sessions) {
  const groups = []
  let current = null

  for (const session of sessions) {
    const key = monthGroupKey(session.date)
    if (!current || current.key !== key) {
      current = { key, sessions: [] }
      groups.push(current)
    }
    current.sessions.push(session)
  }

  return groups
}

export default function SessionsMonthGrid({ sessions, sessionsReturn }) {
  const { t } = useLocale('sessions')
  const months = groupSessionsByMonth(sessions)

  return (
    <div className="sessions-by-month sessions-grid-expanded">
      {months.map((month) => {
        const d = new Date(month.sessions[0].date)
        const mois = t.months[d.getMonth()]
        const annee = d.getFullYear()
        const countLabel = month.sessions.length > 1 ? t.monthSessionMany : t.monthSessionOne
        return (
          <div
            key={month.key}
            className="sessions-month-block"
            role="group"
            aria-labelledby={`sessions-month-${month.key}`}
          >
            <h3 className="sessions-month-label" id={`sessions-month-${month.key}`}>
              <span className="sessions-month-title">
                {mois}
                <span className="sessions-month-year"> {annee}</span>
              </span>
              <span className="sessions-month-count">
                : {month.sessions.length} {countLabel}
              </span>
            </h3>
            <div className="sessions-month-grid">
              {month.sessions.map((s) => (
                <SessionCard key={s.uid} session={s} sessionsReturn={sessionsReturn} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
