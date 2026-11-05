/** Bandeau chiffres-clés / infos rapides en tête de corps d'article. */
function HighlightVisual({ icon, flag, logo, avatar, value }) {
  if (icon === 'flag' && flag) {
    return <img src={flag} alt="" className="article-highlight-flag" loading="lazy" />
  }
  if (icon === 'logo' && logo) {
    return <img src={logo} alt={value} className="article-highlight-logo" loading="lazy" />
  }
  if (icon === 'avatar' && avatar) {
    return <img src={avatar} alt="" className="article-highlight-avatar" loading="lazy" />
  }
  return null
}

export default function ArticleHighlights({ items = [] }) {
  if (!items.length) return null
  return (
    <div className="article-highlights" role="list">
      {items.map((item) => {
        const { label, value, icon } = item
        const showText = icon !== 'logo'
        return (
          <div key={label} className="article-highlight" role="listitem">
            <span className="article-highlight-label">{label}</span>
            <span className={`article-highlight-value${icon ? ` article-highlight-value--${icon}` : ''}`}>
              <HighlightVisual {...item} />
              {showText && <span>{value}</span>}
            </span>
          </div>
        )
      })}
    </div>
  )
}
