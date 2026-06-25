import { isVideoFile, toEmbedVideoUrl } from '../utils/videoEmbed.js'

export default function ArticleVideoEmbed({ url, title = 'Vidéo' }) {
  if (!url) return null

  if (isVideoFile(url)) {
    return <video src={url} controls preload="metadata" title={title} />
  }

  return (
    <iframe
      src={toEmbedVideoUrl(url)}
      title={title}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
    />
  )
}
