import { useVideoFramePoster } from '../utils/videoFramePoster.js'

/** Vignette galerie article extraite d'un MP4 local à t≈N s. */
export default function ArticleVideoFrameImage({ videoUrl, at, className, onError }) {
  const { poster, failed } = useVideoFramePoster(videoUrl, at, Boolean(videoUrl))

  if (failed) {
    onError?.()
    return null
  }

  if (!poster) {
    return <div className={`${className ?? ''} article-gallery-frame--loading`} aria-hidden="true" />
  }

  return <img src={poster} alt="" className={className} loading="lazy" />
}
