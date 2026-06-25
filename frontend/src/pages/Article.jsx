import { useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import SitePageLayout from '../components/SitePageLayout.jsx'
import useLocale from '../hooks/useLocale.js'
import PageCloseButton from '../components/PageCloseButton.jsx'
import ContentNotFound from '../components/ContentNotFound.jsx'
import PreviewSection from '../components/PreviewSection.jsx'
import CardCarousel from '../components/CardCarousel.jsx'
import ArticleCard from '../components/ArticleCard.jsx'
import ArticleBody from '../components/ArticleBody.jsx'
import ArticleMeta from '../components/ArticleMeta.jsx'
import { ARTICLES, getArticle, catSlug } from '../data/articles/index.js'
import { localizedArticleCardBadge, localizedArticleFields } from '../utils/localizeCard.js'
import { resolveArticleDetailCfaoLogo } from '../utils/resolveDetailCfaoLogo.js'
import DetailHeaderLogos from '../components/DetailHeaderLogos.jsx'
import ArticleVideoEmbed from '../components/ArticleVideoEmbed.jsx'
import { resolveArticleMedia } from '../utils/articleMedia.js'
import { sectionTitle } from '../utils/sectionTitle.jsx'
import { ARTICLE_BU_TAB_KEYS } from '../i18n/articlePage.js'
import { SESSION_TAB_KEYS } from '../i18n/sessions.js'

function ArticleHeaderLogos({ article }) {
  const { locale } = useLocale('cards')
  const { logo, label } = localizedArticleCardBadge(article, locale)
  const cfaoLogo = resolveArticleDetailCfaoLogo(article)
  return (
    <DetailHeaderLogos cfaoLogo={cfaoLogo} brandLogo={logo} brandLabel={label} />
  )
}

const RELATED_TAB_IDS = ['all', 'Motors', 'Equipment', 'Carrosserie', 'Parts Motors']

function useArticleViews(slug) {
  const LS_KEY = 'cfao_article_views_v1'
  useEffect(() => {
    if (!slug) return
    try {
      const prev = JSON.parse(localStorage.getItem(LS_KEY) || '{}')
      prev[slug] = (prev[slug] ?? 0) + 1
      localStorage.setItem(LS_KEY, JSON.stringify(prev))
    } catch {}
  }, [slug])
}

export default function Article() {
  const { slug } = useParams()
  const { locale, t: pageT } = useLocale('articlePage')
  const { t: nfT } = useLocale('notFound')
  const { t: sessionsT } = useLocale('sessions')
  const article = getArticle(slug)
  useArticleViews(slug)
  const media = article ? resolveArticleMedia(article) : null

  const relatedTabs = useMemo(
    () => RELATED_TAB_IDS.map((id) => {
      const labelKey = ARTICLE_BU_TAB_KEYS[id]
      const label = labelKey === 'tabAll'
        ? pageT.tabAll
        : labelKey === 'tabParts'
          ? pageT.tabParts
          : sessionsT[SESSION_TAB_KEYS[id]] ?? id
      return {
        id,
        label,
        count:
          id === 'all'
            ? ARTICLES.length - 1
            : ARTICLES.filter((a) => a.bu === id && a.slug !== article?.slug).length,
      }
    }),
    [pageT, sessionsT, article?.slug],
  )

  if (!article) {
    return (
      <SitePageLayout navActive="actualites">
        <main className="article-page">
          <div className="container article-shell">
            <PageCloseButton to="/" ariaLabel={pageT.closeHome} />
            <ContentNotFound
              eyebrow={nfT.eyebrow}
              title={pageT.notFoundTitle}
              lead={pageT.notFoundLead}
              primaryTo="/actualites"
              primaryLabel={nfT.backToNews}
              secondaryTo="/"
              secondaryLabel={nfT.backToHome}
            />
          </div>
        </main>
      </SitePageLayout>
    )
  }

  const copy = localizedArticleFields(article, locale)

  return (
    <SitePageLayout navActive="actualites">
      <main className="article-page">
        <div className="container article-shell">
          <PageCloseButton to="/" ariaLabel={pageT.closeArticle} />

          <div className="article-main">
              <article className="article-sheet">
                <header className="article-header">
                  <ArticleHeaderLogos article={article} />
                  <div className={`news-tag news-tag--${catSlug(article.category)}`}>
                    {copy.categoryLabel}
                  </div>
                  <ArticleMeta
                    dateLabel={copy.dateLabel}
                    readTime={article.readTime}
                    brand={article.brand}
                  />
                  <h1>{copy.title}</h1>
                  <p className="article-lead">{copy.summary}</p>
                </header>

                {media.heroVideo && (
                  <figure className="article-hero article-hero--video">
                    <ArticleVideoEmbed url={media.heroVideo} title={copy.title} />
                  </figure>
                )}
                {!media.heroVideo && media.heroImage && (
                  <figure className="article-hero">
                    <img src={media.heroImage} alt="" />
                  </figure>
                )}

                <ArticleBody
                  key={`${article.slug}-${locale}`}
                  content={copy.content}
                  photos={media.galleryPhotos}
                  videos={media.bodyVideos}
                  articleSlug={article.slug}
                />
              </article>
          </div>
        </div>

        <PreviewSection
          ix={pageT.relatedIx}
          title={sectionTitle(pageT.relatedTitleBefore, pageT.relatedTitleEm, pageT.relatedTitleAfter)}
          tabs={relatedTabs}
        >
          {(active) => {
            const items = (
              active === 'all'
                ? ARTICLES.filter((a) => a.slug !== article.slug)
                : ARTICLES.filter((a) => a.slug !== article.slug && a.bu === active)
            ).slice(0, 3)
            return (
              <CardCarousel className="card-carousel--news">
                {items.map((a) => (
                  <ArticleCard key={a.slug} article={a} />
                ))}
              </CardCarousel>
            )
          }}
        </PreviewSection>
      </main>
    </SitePageLayout>
  )
}
