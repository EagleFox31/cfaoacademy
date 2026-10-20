import { GuideTourIcon, LifeBuoyIcon } from '../../components/portalSectionIcons.jsx'
import { useHelp } from '../context/HelpProvider.jsx'
import HelpArticleView from './HelpArticleView.jsx'

function HelpArticleList({ articles, onSelect }) {
  if (!articles.length) return null
  return (
    <ul className="help-article-list">
      {articles.map((article) => (
        <li key={article.id}>
          <button type="button" className="help-article-list-item" onClick={() => onSelect(article.id)}>
            <span className="help-article-list-title">{article.title}</span>
            <span className="help-article-list-summary">{article.summary}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

export default function HelpCenterPanel({ mode = 'drawer', onClose }) {
  const {
    copy,
    query,
    setQuery,
    activeTopic,
    setActiveTopic,
    topics,
    contextualArticles,
    searchResults,
    catalogArticles,
    activeArticle,
    clearArticle,
    openArticle,
    hasFullTour,
    startFullTour,
    contactExpert,
    closeHelp,
  } = useHelp()

  const handleClose = () => {
    closeHelp()
    onClose?.()
  }

  const showSearch = query.trim().length > 0
  const listArticles = showSearch ? searchResults : catalogArticles

  return (
    <aside
      className={`help-center-panel help-center-panel--${mode}`}
      aria-label={copy.center_title}
    >
      <header className="help-center-head">
        <div>
          <h2 className="help-center-title">{copy.center_title}</h2>
          <p className="help-center-lead">{copy.center_lead}</p>
        </div>
        {mode === 'drawer' ? (
          <button type="button" className="help-center-close" onClick={handleClose} aria-label={copy.action_close}>
            ×
          </button>
        ) : null}
      </header>

      <div className="help-center-search">
        <input
          type="search"
          className="help-center-search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={copy.search_placeholder}
          aria-label={copy.search_placeholder}
        />
      </div>

      {activeArticle ? (
        <HelpArticleView article={activeArticle} copy={copy} onBack={clearArticle} />
      ) : (
        <div className="help-center-body">
          {!showSearch && contextualArticles.length > 0 ? (
            <section className="help-center-section">
              <h3 className="help-center-section-title">{copy.section_context}</h3>
              <HelpArticleList articles={contextualArticles} onSelect={openArticle} />
            </section>
          ) : null}

          <section className="help-center-section">
            <h3 className="help-center-section-title">{copy.section_actions}</h3>
            <div className="help-action-list">
              {hasFullTour ? (
                <button type="button" className="help-action-card" onClick={startFullTour}>
                  <span className="help-action-icon help-action-icon--tour" aria-hidden="true">
                    <GuideTourIcon size={18} strokeWidth={2.2} />
                  </span>
                  <span className="help-action-copy">
                    <span className="help-action-title">{copy.action_full_tour}</span>
                    <span className="help-action-desc">{copy.action_full_tour_desc}</span>
                  </span>
                </button>
              ) : null}
              <button type="button" className="help-action-card" onClick={contactExpert}>
                <span className="help-action-icon help-action-icon--contact" aria-hidden="true">
                  <LifeBuoyIcon size={18} strokeWidth={2.2} />
                </span>
                <span className="help-action-copy">
                  <span className="help-action-title">{copy.action_contact}</span>
                  <span className="help-action-desc">{copy.action_contact_desc}</span>
                </span>
              </button>
            </div>
          </section>

          {!showSearch ? (
            <section className="help-center-section">
              <h3 className="help-center-section-title">{copy.section_topics}</h3>
              <div className="help-topic-chips">
                <button
                  type="button"
                  className={`help-topic-chip${!activeTopic ? ' is-active' : ''}`}
                  onClick={() => setActiveTopic(null)}
                >
                  {copy.section_guides}
                </button>
                {topics.map((topic) => (
                  <button
                    key={topic.id}
                    type="button"
                    className={`help-topic-chip${activeTopic === topic.id ? ' is-active' : ''}`}
                    onClick={() => setActiveTopic(topic.id)}
                  >
                    {copy[topic.labelKey]}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section className="help-center-section">
            <h3 className="help-center-section-title">
              {showSearch ? copy.search_placeholder : copy.section_guides}
            </h3>
            {listArticles.length > 0 ? (
              <HelpArticleList articles={listArticles} onSelect={openArticle} />
            ) : (
              <p className="help-center-empty">{copy.search_empty}</p>
            )}
          </section>
        </div>
      )}
    </aside>
  )
}
