import { getVideoThumbnail } from './videoEmbed.js'
import { VIDEO_FRAME_POSTER_SEC } from './videoFramePoster.js'

function isImageGalleryItem(item) {
  return typeof item === 'string' || item?.type === 'image'
}

function galleryImageSrc(item) {
  return typeof item === 'string' ? item : item?.src ?? null
}

function buildGalleryItems(photos = [], photoCaptures = [], videos = []) {
  const items = [
    ...photos.filter(Boolean).map((src) => ({ type: 'image', src })),
    ...photoCaptures
      .filter((c) => c?.at != null && videos[c.videoIndex ?? 0])
      .map((c) => ({
        type: 'videoFrame',
        videoUrl: videos[c.videoIndex ?? 0],
        at: c.at,
      })),
  ]
  return items
}

/**
 * Répartit cover / photos / vidéos : la 1ʳᵉ vidéo remplace le hero image ;
 * le cover rejoint la galerie en bas si une vidéo est présente.
 */
export function resolveArticleMedia({
  cover = null,
  photos = [],
  photoCaptures = [],
  videos = [],
} = {}) {
  const list = Array.isArray(videos) ? videos.filter(Boolean) : []
  const heroVideo = list[0] ?? null
  const bodyVideos = heroVideo ? list.slice(1) : list

  const galleryPhotos = buildGalleryItems(photos, photoCaptures, list)
  if (heroVideo && cover && !galleryPhotos.some((i) => isImageGalleryItem(i) && galleryImageSrc(i) === cover)) {
    galleryPhotos.unshift({ type: 'image', src: cover })
  }

  const heroImage = heroVideo ? null : cover
  const fallbackImage = galleryImageSrc(galleryPhotos.find(isImageGalleryItem)) || cover || null
  const remotePoster = heroVideo ? getVideoThumbnail(heroVideo) : null
  /** YouTube/Vimeo : vignette distante ; MP4 local : frame ~8 s côté composant. */
  const videoPoster = remotePoster || null

  return {
    heroVideo,
    heroImage,
    galleryPhotos,
    bodyVideos,
    videoPoster,
    framePosterSec: VIDEO_FRAME_POSTER_SEC,
    cardPreview: heroVideo
      ? {
          type: 'video',
          videoUrl: heroVideo,
          thumbnail: remotePoster,
          fallbackImage,
          framePosterSec: VIDEO_FRAME_POSTER_SEC,
        }
      : {
          type: 'image',
          image: fallbackImage,
        },
  }
}
