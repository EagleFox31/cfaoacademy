import { useEffect, useState } from 'react'
import { parseArticleBlocks } from '../utils/articleContent.js'
import ArticleVideoEmbed from './ArticleVideoEmbed.jsx'
import ArticleVideoFrameImage from './ArticleVideoFrameImage.jsx'
import ArticleHighlights from './ArticleHighlights.jsx'
import ArticleCastGrid from './ArticleCastGrid.jsx'

function galleryItemKey(item, index) {
  if (typeof item === 'string') return item
  if (item?.type === 'image') return item.src
  if (item?.type === 'videoFrame') return `frame-${item.videoUrl}-${item.at}`
  return `gallery-${index}`
}

function ArticleGalleryImage({ item, onDrop }) {
  if (typeof item === 'string' || item?.type === 'image') {
    const src = typeof item === 'string' ? item : item.src
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => onDrop(item)}
      />
    )
  }
  if (item?.type === 'videoFrame') {
    return (
      <ArticleVideoFrameImage
        videoUrl={item.videoUrl}
        at={item.at}
        onError={() => onDrop(item)}
      />
    )
  }
  return null
}

function ArticleGallery({ urls, wide = false }) {
  const [visible, setVisible] = useState(urls)

  useEffect(() => {
    setVisible(urls)
  }, [urls])

  if (!visible.length) return null

  const cols = visible.length === 1 ? 1 : visible.length === 2 ? 2 : 3

  const dropItem = (item) => {
    const key = galleryItemKey(item, 0)
    setVisible((prev) => prev.filter((entry) => galleryItemKey(entry, 0) !== key))
  }

  return (
    <figure className={`article-figure${wide ? ' article-figure--wide' : ''}`}>
      <div className={`article-gallery cols-${cols}`}>
        {visible.map((item, index) => (
          <ArticleGalleryImage key={galleryItemKey(item, index)} item={item} onDrop={dropItem} />
        ))}
      </div>
    </figure>
  )
}

function BlockContent({ block, isFirstParagraph }) {
  if (block.type === 'heading') {
    return <h2 className="article-prose-heading">{block.text}</h2>
  }
  if (block.type === 'paragraph') {
    return (
      <p className={isFirstParagraph ? 'article-prose-lead' : undefined}>{block.text}</p>
    )
  }
  if (block.type === 'quote') {
    return (
      <blockquote className="article-pullquote">
        <p>{block.text}</p>
      </blockquote>
    )
  }
  if (block.type === 'photo' || block.type === 'gallery') {
    return <ArticleGallery urls={block.urls} wide={block.urls.length === 1} />
  }
  if (block.type === 'videos') {
    return (
      <div className="article-figure article-figure--video">
        {block.urls.map((src, i) => (
          <ArticleVideoEmbed key={i} url={src} title={`Vidéo ${i + 1}`} />
        ))}
      </div>
    )
  }
  return null
}

export default function ArticleBody({
  content,
  photos = [],
  videos = [],
  articleSlug,
  highlights = [],
  cast = [],
  castTitle,
}) {
  const blocks = parseArticleBlocks(content, photos, videos, articleSlug)
  let firstParagraphSeen = false

  return (
    <div className="article-prose">
      <ArticleHighlights items={highlights} />
      {blocks.map((block) => {
        const isFirstParagraph = block.type === 'paragraph' && !firstParagraphSeen
        if (isFirstParagraph) firstParagraphSeen = true

        const node = (
          <>
            <BlockContent block={block} isFirstParagraph={isFirstParagraph} />
            {isFirstParagraph && cast.length > 0 && (
              <ArticleCastGrid title={castTitle} people={cast} />
            )}
          </>
        )

        return block.inToc ? (
          <div key={block.key} id={block.id} className="article-section">
            {node}
          </div>
        ) : (
          <div key={block.key}>{node}</div>
        )
      })}
    </div>
  )
}
