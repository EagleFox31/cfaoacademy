import { describe, expect, it } from 'vitest'
import { localVideoPoster, resolveArticleMedia } from './articleMedia.js'

describe('vignette des vidéos d’article', () => {
  it('un MP4 hébergé a sa vignette JPG de même nom', () => {
    expect(localVideoPoster('/assets/videos_articles/Formation%20YAMAHA%20Moto%20EN.mp4'))
      .toBe('/assets/videos_articles/Formation%20YAMAHA%20Moto%20EN.jpg')
    expect(localVideoPoster('/v/a.webm?v=2')).toBe('/v/a.jpg')
  })

  it('pas de vignette locale pour YouTube ni pour une URL vide', () => {
    expect(localVideoPoster('https://www.youtube.com/watch?v=abc')).toBeNull()
    expect(localVideoPoster(null)).toBeNull()
  })

  it('la carte et le haut d’article reçoivent la vignette, la couverture reste en repli', () => {
    const media = resolveArticleMedia({ cover: '/c.jpg', videos: ['/v/film.mp4'] })
    expect(media.videoPoster).toBe('/v/film.jpg')
    expect(media.cardPreview).toMatchObject({ thumbnail: '/v/film.jpg', fallbackImage: '/c.jpg' })
  })

  it('YouTube garde sa vignette distante', () => {
    const media = resolveArticleMedia({ videos: ['https://youtu.be/abc123def45'] })
    expect(media.videoPoster).toBe('https://img.youtube.com/vi/abc123def45/hqdefault.jpg')
  })
})
