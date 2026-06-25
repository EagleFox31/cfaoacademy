import ArticleToc from './ArticleToc.jsx'
import ArticleRelatedSession from './ArticleRelatedSession.jsx'

export default function ArticleSidebar({ sections, session }) {
  const showToc = sections.length >= 2
  if (!showToc && !session) return null

  return (
    <div className="article-sidebar-sticky">
      {showToc && <ArticleToc sections={sections} />}
      <ArticleRelatedSession session={session} />
    </div>
  )
}
