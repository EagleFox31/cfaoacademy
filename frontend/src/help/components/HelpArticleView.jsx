import HelpArticleBody from './HelpArticleBody.jsx'

export default function HelpArticleView({ article, copy, onBack }) {
  if (!article) return null

  return (
    <article className="help-article-view">
      <button type="button" className="help-back-btn" onClick={onBack}>
        ← {copy.action_back}
      </button>
      <h2 className="help-article-view-title">{article.title}</h2>
      <p className="help-article-view-summary">{article.summary}</p>
      <HelpArticleBody body={article.body} />
    </article>
  )
}
