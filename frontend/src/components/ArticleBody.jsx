import { useEffect, useState } from 'react'
import { parseArticleBlocks } from '../utils/articleContent.js'
import ArticleVideoEmbed from './ArticleVideoEmbed.jsx'

function ArticleGallery({ urls }) {
  const [visible, setVisible] = useState(urls)

  useEffect(() => {
    setVisible(urls)
  }, [urls])

  if (!visible.length) return null

  const cols = visible.length === 1 ? 1 : visible.length === 2 ? 2 : 3

  return (
    <figure className="article-figure">
      <div className={`article-gallery cols-${cols}`}>
        {visible.map((src) => (
          <img
            key={src}
            src={src}
            alt=""
            loading="lazy"
            onError={() => setVisible((prev) => prev.filter((u) => u !== src))}
          />
        ))}
      </div>
    </figure>
  )
}

function BlockContent({ block }) {
  if (block.type === 'paragraph') {
    return <p>{block.text}</p>
  }
  if (block.type === 'quote') {
    return (
      <blockquote className="article-pullquote">
        <p>{block.text}</p>
      </blockquote>
    )
  }
  if (block.type === 'photo' || block.type === 'gallery') {
    return <ArticleGallery urls={block.urls} />
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

export default function ArticleBody({ content, photos = [], videos = [], articleSlug }) {
  const blocks = parseArticleBlocks(content, photos, videos, articleSlug)

  return (
    <div className="article-prose">
      {blocks.map((block) =>
        block.inToc ? (
          <div key={block.key} id={block.id} className="article-section">
            <BlockContent block={block} />
          </div>
        ) : (
          <div key={block.key}>
            <BlockContent block={block} />
          </div>
        ),
      )}
    </div>
  )
}
