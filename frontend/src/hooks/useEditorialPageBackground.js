import { useEffect } from 'react'
import { EDITORIAL_PAGE_BG, EDITORIAL_PAGE_BG_POSITION } from '../data/editorialPageBg.js'

/**
 * Photo fixe sur `body` — restaurée au démontage.
 * @param {{ src?: string | null, position?: string }} [options]
 */
export default function useEditorialPageBackground({ src, position } = {}) {
  const image = src || EDITORIAL_PAGE_BG
  const imagePosition = position || EDITORIAL_PAGE_BG_POSITION

  useEffect(() => {
    const body = document.body
    body.classList.add('editorial-page-bg')
    body.style.setProperty('--editorial-page-bg', `url('${image}')`)
    body.style.setProperty('--editorial-page-bg-position', imagePosition)

    return () => {
      body.classList.remove('editorial-page-bg')
      body.style.removeProperty('--editorial-page-bg')
      body.style.removeProperty('--editorial-page-bg-position')
    }
  }, [image, imagePosition])
}
