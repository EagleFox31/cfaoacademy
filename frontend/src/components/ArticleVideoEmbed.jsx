import { forwardRef, useRef } from 'react'
import { isVideoFile, toEmbedVideoUrl } from '../utils/videoEmbed.js'
import { useVideoFramePoster, VIDEO_FRAME_POSTER_SEC } from '../utils/videoFramePoster.js'

const ArticleVideoEmbed = forwardRef(function ArticleVideoEmbed(
  {
    url,
    title = 'Vidéo',
    poster,
    framePosterSec = VIDEO_FRAME_POSTER_SEC,
    autoPlay = false,
  },
  ref,
) {
  const needsFrame = Boolean(url) && isVideoFile(url) && !poster
  const { poster: capturedPoster } = useVideoFramePoster(url, framePosterSec, needsFrame)

  if (!url) return null

  const effectivePoster = poster || capturedPoster || undefined

  if (isVideoFile(url)) {
    return (
      <video
        ref={ref}
        src={url}
        controls
        playsInline
        autoPlay={autoPlay}
        preload={autoPlay ? 'auto' : 'metadata'}
        poster={effectivePoster}
        title={title}
      />
    )
  }

  const embedUrl = autoPlay
    ? `${toEmbedVideoUrl(url)}${toEmbedVideoUrl(url).includes('?') ? '&' : '?'}autoplay=1`
    : toEmbedVideoUrl(url)

  return (
    <iframe
      src={embedUrl}
      title={title}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
    />
  )
})

export default ArticleVideoEmbed
