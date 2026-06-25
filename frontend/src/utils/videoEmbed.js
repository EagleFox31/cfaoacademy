/** Fichiers vidéo hébergés (lecteur natif). */
export function isVideoFile(url) {
  return /\.(mp4|webm|ogg)(\?|$)/i.test(url ?? '')
}

/** ID YouTube (watch, embed, youtu.be, shorts) ou null. */
export function getYoutubeVideoId(url) {
  const raw = (url ?? '').trim()
  if (!raw) return null

  try {
    const parsed = new URL(raw, 'https://example.com')
    const host = parsed.hostname.replace(/^www\./, '')

    if (host === 'youtu.be') {
      const id = parsed.pathname.slice(1).split('/')[0]
      return id || null
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (parsed.pathname.startsWith('/embed/')) {
        return parsed.pathname.split('/')[2] || null
      }
      return (
        parsed.searchParams.get('v')
        ?? parsed.pathname.match(/^\/shorts\/([^/?]+)/)?.[1]
        ?? null
      )
    }
  } catch {
    return null
  }

  return null
}

/** Vignette pour preview carte / hero de repli. */
export function getVideoThumbnail(url) {
  const yt = getYoutubeVideoId(url)
  if (yt) return `https://img.youtube.com/vi/${yt}/hqdefault.jpg`

  try {
    const parsed = new URL(url, 'https://example.com')
    const host = parsed.hostname.replace(/^www\./, '')
    if (host === 'vimeo.com') {
      const id = parsed.pathname.match(/^\/(\d+)/)?.[1]
      if (id) return `https://vumbnail.com/${id}.jpg`
    }
  } catch {
    /* ignore */
  }

  return null
}

function withQueryParams(base, params) {
  const u = new URL(base)
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') u.searchParams.set(k, String(v))
  }
  return u.toString()
}

/**
 * URL lisible par un &lt;iframe&gt; (lecteur intégré, sans quitter le site).
 * Accepte liens YouTube / Vimeo « partager » ou « regarder », pas seulement /embed/.
 */
export function toEmbedVideoUrl(url) {
  const raw = (url ?? '').trim()
  if (!raw || isVideoFile(raw)) return raw

  const yt = getYoutubeVideoId(raw)
  if (yt) return `https://www.youtube.com/embed/${yt}`

  try {
    const parsed = new URL(raw, 'https://example.com')
    const host = parsed.hostname.replace(/^www\./, '')

    if (host === 'vimeo.com') {
      const id = parsed.pathname.match(/^\/(\d+)/)?.[1]
      if (id) return `https://player.vimeo.com/video/${id}`
    }

    if (host === 'player.vimeo.com') return raw
  } catch {
    /* ignore */
  }

  return raw
}

/** Preview carte accueil : ~5 s en muet au survol. */
export function getCardHoverPreview(url, durationSec = 5) {
  const raw = (url ?? '').trim()
  if (!raw) return null

  if (isVideoFile(raw)) {
    return { kind: 'file', url: raw }
  }

  const yt = getYoutubeVideoId(raw)
  if (yt) {
    return {
      kind: 'iframe',
      url: withQueryParams(`https://www.youtube.com/embed/${yt}`, {
        autoplay: '1',
        mute: '1',
        controls: '0',
        modestbranding: '1',
        rel: '0',
        playsinline: '1',
        start: '0',
        end: String(durationSec),
      }),
    }
  }

  try {
    const parsed = new URL(raw, 'https://example.com')
    const host = parsed.hostname.replace(/^www\./, '')
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const id =
        parsed.pathname.match(/^\/(\d+)/)?.[1]
        ?? parsed.pathname.match(/^\/video\/(\d+)/)?.[1]
      if (id) {
        return {
          kind: 'iframe',
          url: withQueryParams(`https://player.vimeo.com/video/${id}`, {
            autoplay: '1',
            muted: '1',
            background: '1',
            controls: '0',
          }),
        }
      }
    }
  } catch {
    /* ignore */
  }

  const embed = toEmbedVideoUrl(raw)
  if (embed && embed !== raw) {
    return { kind: 'iframe', url: embed }
  }

  return null
}

export const CARD_VIDEO_PREVIEW_MS = 5000
