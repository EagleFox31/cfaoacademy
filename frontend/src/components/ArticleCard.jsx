import PvCard from './PvCard.jsx'
import ArticleCardMedia from './ArticleCardMedia.jsx'
import { catSlug } from '../data/articles/index.js'
import { resolveArticleMedia } from '../utils/articleMedia.js'
import useLocale from '../hooks/useLocale.js'
import { localizedArticleCardBadge, localizedArticleFields } from '../utils/localizeCard.js'

export default function ArticleCard({ article, cta }) {
  const { locale, t: cardsT } = useLocale('cards')
  const { logo, label } = localizedArticleCardBadge(article, locale)
  const { cardPreview } = resolveArticleMedia(article)
  const copy = localizedArticleFields(article, locale)
  const kicker = (
    <span className={`news-tag news-tag--${catSlug(article.category)}`}>{copy.categoryLabel}</span>
  )

  return (
    <PvCard
      className="pv-card--article"
      to={`/actualites/${article.slug}`}
      cardMedia={<ArticleCardMedia preview={cardPreview} />}
      logo={logo}
      brandLabel={label}
      kicker={kicker}
      title={copy.title}
      meta={copy.summary}
      ctaAside={copy.dateLabel}
      ctaDateTime={article.date}
      cta={cta ?? cardsT.readArticle}
      hoverHint={cardsT.readArticleHint}
    />
  )
}
