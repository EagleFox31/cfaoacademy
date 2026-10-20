import { resolveArticleMedia } from './articleMedia.js'

function galleryItemKey(item) {
  if (item?.type === 'videoFrame') return `frame:${item.videoUrl}:${item.at}`
  return `img:${item?.src ?? ''}`
}

function dedupeGalleryItems(items) {
  const seen = new Set()
  const out = []
  for (const item of items) {
    const key = galleryItemKey(item)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

/** Deux visuels distincts pour le hero news (cover + photo ou capture vidéo). */
export function resolveHeroNewsGallery(article, max = 2) {
  const { galleryPhotos, heroImage } = resolveArticleMedia({
    cover: article?.cover ?? null,
    photos: article?.photos ?? [],
    photoCaptures: article?.photoCaptures ?? [],
    videos: article?.videos ?? [],
  })

  const items = dedupeGalleryItems(galleryPhotos)
  const lead = heroImage || article?.cover
  if (lead && !items.some((i) => i.type === 'image' && i.src === lead)) {
    items.unshift({ type: 'image', src: lead })
  }

  if (items.length === 0) {
    return [{ type: 'image', src: lead || '/assets/logo-cfao-mobility.jpg' }]
  }

  return items.slice(0, max)
}

export function heroNewsGalleryStaticSrcs(gallery = []) {
  return gallery
    .filter((item) => item.type === 'image' && item.src)
    .map((item) => item.src)
}
