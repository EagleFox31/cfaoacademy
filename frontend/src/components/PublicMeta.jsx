function MetaIcon({ children }) {
  return <span className="article-meta-pill-icon" aria-hidden="true">{children}</span>
}

export default function PublicMeta({ famille, niv, brandLabel }) {
  return (
    <ul className="article-meta" aria-label="Informations sur le public">
      {famille && (
        <li>
          <span className="article-meta-pill article-meta-pill--date">
            <MetaIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h7" />
              </svg>
            </MetaIcon>
            {famille}
          </span>
        </li>
      )}
      {niv && (
        <li>
          <span className="article-meta-pill article-meta-pill--read">
            <MetaIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" />
              </svg>
            </MetaIcon>
            {niv}
          </span>
        </li>
      )}
      {brandLabel && (
        <li>
          <span className="article-meta-pill article-meta-pill--brand">
            <MetaIcon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 0 1 0 2.828l-7 7a2 2 0 0 1-2.828 0l-7-7A2 2 0 0 1 3 12V7a4 4 0 0 1 4-4z" />
              </svg>
            </MetaIcon>
            {brandLabel}
          </span>
        </li>
      )}
    </ul>
  )
}
