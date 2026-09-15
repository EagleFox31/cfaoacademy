/** Découpe le contenu article et prépare les ancres pour la table des matières. */

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'section'
}

function tocLabel(text, index, type) {
  if (type === 'heading') return text.replace(/^##\s+/, '').trim()
  if (type === 'quote') return 'Citation'
  if (type === 'gallery') return 'Galerie photos'
  if (type === 'videos') return 'Vidéo'
  if (type === 'photo') return 'Illustration'
  if (index === 0) return 'Introduction'
  const short = text.replace(/\s+/g, ' ').trim()
  return short.length > 52 ? `${short.slice(0, 49).trim()}…` : short
}

const TOC_TYPES = new Set(['paragraph', 'heading', 'quote', 'gallery', 'videos', 'photo'])

export function parseArticleBlocks(content, photos = [], videos = [], articleSlug = 'article') {
  const paragraphs = content.split(/\n\n+/).map((p) => p.trim()).filter(Boolean)
  const blocks = []
  let sectionIndex = 0

  const addBlock = (block) => {
    const id = `${articleSlug}-${slugify(block.tocText || String(sectionIndex))}-${sectionIndex}`
    blocks.push({
      ...block,
      id,
      tocLabel: tocLabel(block.tocText || '', sectionIndex, block.type),
      inToc: TOC_TYPES.has(block.type),
    })
    sectionIndex += 1
  }

  paragraphs.forEach((text, i) => {
    if (/^##\s+/.test(text)) {
      addBlock({
        type: 'heading',
        text: text.replace(/^##\s+/, '').trim(),
        tocText: text,
        key: `h-${i}`,
      })
      return
    }
    const isQuote = /^[«"“]/.test(text) || (text.includes('«') && text.length < 320)
    addBlock({
      type: isQuote ? 'quote' : 'paragraph',
      text,
      tocText: text,
      key: `p-${i}`,
    })
  })

  if (photos.length) {
    addBlock({
      type: 'gallery',
      urls: photos,
      tocText: 'Galerie',
      key: `${articleSlug}-gallery`,
    })
  }
  if (videos.length) {
    addBlock({
      type: 'videos',
      urls: videos,
      tocText: 'Vidéo',
      key: `${articleSlug}-videos`,
    })
  }

  return blocks
}

export function getTocSections(blocks) {
  return blocks
    .filter((b) => b.inToc)
    .map((b) => ({ id: b.id, label: b.tocLabel }))
}
