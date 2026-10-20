import { useRef } from 'react'
import ArticleVideoEmbed from './ArticleVideoEmbed.jsx'
import PageCloseButton from './PageCloseButton.jsx'
import { useArticleHeroVideo } from '../hooks/useArticleHeroVideo.js'
import { isVideoFile } from '../utils/videoEmbed.js'

/**
 * Vidéo hero article : lecture fluide + continuité absolue au scroll en miniature (zéro redémarrage).
 */
export default function ArticleHeroVideo({
  url,
  title,
  poster,
  framePosterSec,
  closeTo,
  closeAriaLabel,
}) {
  const figureRef = useRef(null)
  const videoRef = useRef(null)
  const floatOnScroll = isVideoFile(url)

  const { floating, dismissFloat, bindVideoRef } = useArticleHeroVideo({
    figureRef,
    videoRef,
    url,
    autoPlay: true,
    floatOnScroll,
  })

  return (
    <figure
      ref={figureRef}
      className={`article-hero article-hero--video${floating ? ' is-floating' : ''}`}
    >
      {floating && <div className="article-hero-pip-spacer" aria-hidden="true" />}
      <div
        className={`article-hero-video-wrap${floating ? ' article-hero-video-wrap--pip' : ''}`}
      >
        {closeTo != null && !floating && (
          <PageCloseButton
            to={closeTo}
            ariaLabel={closeAriaLabel}
            className="article-hero-media-close"
          />
        )}
        <ArticleVideoEmbed
          ref={bindVideoRef}
          url={url}
          title={title}
          poster={poster}
          framePosterSec={framePosterSec}
          autoPlay
          isFloating={floating}
          onExpand={() => {
            figureRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }}
        />
        {floating && (
          <button
            type="button"
            className="article-hero-pip-close"
            aria-label="Fermer la vidéo miniature"
            title="Fermer la miniature"
            onClick={dismissFloat}
          >
            ×
          </button>
        )}
      </div>
    </figure>
  )
}
