import { forwardRef } from 'react'
import { isVideoFile, toEmbedVideoUrl } from '../utils/videoEmbed.js'
import { useVideoFramePoster, VIDEO_FRAME_POSTER_SEC } from '../utils/videoFramePoster.js'
import CustomVideoPlayer from './CustomVideoPlayer.jsx'

const ArticleVideoEmbed = forwardRef(function ArticleVideoEmbed(
  {
    url,
    title = 'Vidéo',
    poster,
    framePosterSec = VIDEO_FRAME_POSTER_SEC,
    autoPlay = false,
    isFloating = false,
    onExpand,
  },
  ref,
) {
  const needsFrame = Boolean(url) && isVideoFile(url) && !poster
  const { poster: capturedPoster } = useVideoFramePoster(url, framePosterSec, needsFrame)

  if (!url) return null

  const effectivePoster = poster || capturedPoster || undefined

  if (isVideoFile(url)) {
    return (
      <CustomVideoPlayer
        ref={ref}
        src={url}
        poster={effectivePoster}
        title={title}
        autoPlay={autoPlay}
        isFloating={isFloating}
        onExpand={onExpand}
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
