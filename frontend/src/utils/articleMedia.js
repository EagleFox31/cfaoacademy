import { getVideoThumbnail } from './videoEmbed.js'

/**
 * Répartit cover / photos / vidéos : la 1ʳᵉ vidéo remplace le hero image ;
 * le cover rejoint la galerie en bas si une vidéo est présente.
 */
export function resolveArticleMedia({ cover = null, photos = [], videos = [] } = {}) {
  const list = Array.isArray(videos) ? videos.filter(Boolean) : []
  const heroVideo = list[0] ?? null
  const bodyVideos = heroVideo ? list.slice(1) : list

  const galleryPhotos = [...(Array.isArray(photos) ? photos : [])]
  if (heroVideo && cover && !galleryPhotos.includes(cover)) {
    galleryPhotos.unshift(cover)
  }

  const heroImage = heroVideo ? null : cover
  const cardImage = cover || galleryPhotos[0] || null
  const cardThumbnail = heroVideo ? getVideoThumbnail(heroVideo) : null

  return {
    heroVideo,
    heroImage,
    galleryPhotos,
    bodyVideos,
    cardPreview: heroVideo
      ? {
          type: 'video',
          videoUrl: heroVideo,
          thumbnail: cardThumbnail,
          fallbackImage: cardImage,
        }
      : {
          type: 'image',
          image: cardImage,
        },
  }
}
