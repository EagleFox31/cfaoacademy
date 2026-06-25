import useLocale from '../hooks/useLocale.js'

function MetaIcon({ children }) {
  return <span className="article-meta-pill-icon" aria-hidden="true">{children}</span>
}

function formatReadTime(readTime, suffix) {
  const t = readTime?.trim()
  if (!t) return null
  return /lecture|read/i.test(t) ? t : `${t} ${suffix}`
}

export default function ArticleMeta({ dateLabel, readTime, brand }) {
  const { t: pageT } = useLocale('articlePage')
  const readLabel = formatReadTime(readTime, pageT.readTimeSuffix)

  return (
    <ul className="article-meta" aria-label={pageT.metaAria}>
      <li>
        <span className="article-meta-pill article-meta-pill--date">
          <MetaIcon>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </MetaIcon>
          {dateLabel}
        </span>
      </li>
      {readLabel && (
        <li>
          <span className="article-meta-pill article-meta-pill--read">
            <MetaIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            </MetaIcon>
            {readLabel}
          </span>
        </li>
      )}
      {brand && (
        <li>
          <span className="article-meta-pill article-meta-pill--brand">
            <MetaIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 0 1 0 2.828l-7 7a2 2 0 0 1-2.828 0l-7-7A2 2 0 0 1 3 12V7a4 4 0 0 1 4-4z" />
              </svg>
            </MetaIcon>
            {brand}
          </span>
        </li>
      )}
    </ul>
  )
}
