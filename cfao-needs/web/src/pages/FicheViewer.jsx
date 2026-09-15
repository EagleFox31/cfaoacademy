/**
 * Viewer fiche formation — destiné à s'ouvrir en fenêtre dédiée
 * (`window.open`) pour comparer plusieurs thématiques côte à côte.
 */
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'

import PageCloseButton from '../components/PageCloseButton'
import { useLocale } from '../i18n'
import { ficheUrlsForLine } from '../lib/fichePaths'

async function probeUrl(url) {
  if (!url) return false
  try {
    const head = await fetch(url, { method: 'HEAD', cache: 'no-store' })
    if (head.ok) return true
    // Certains serveurs refusent HEAD : retente en GET léger.
    if (head.status === 405 || head.status === 501) {
      const get = await fetch(url, { method: 'GET', cache: 'no-store' })
      return get.ok
    }
    return false
  } catch {
    return false
  }
}

export default function FicheViewer() {
  const { t } = useLocale()
  const { code: rawCode } = useParams()
  const [params] = useSearchParams()
  const code = decodeURIComponent(rawCode || '')
  const brand = params.get('brand') || ''
  const family = params.get('family') || ''
  const title = params.get('title') || ''

  const urls = ficheUrlsForLine({ code, brand_code: brand, family_key: family })
  const [pngOk, setPngOk] = useState(null)
  const [pdfOk, setPdfOk] = useState(null)

  useEffect(() => {
    let alive = true
    setPngOk(null)
    setPdfOk(null)
    ;(async () => {
      const [png, pdf] = await Promise.all([
        urls.pngUrl ? probeUrl(urls.pngUrl) : Promise.resolve(false),
        urls.pdfUrl ? probeUrl(urls.pdfUrl) : Promise.resolve(false),
      ])
      if (!alive) return
      setPngOk(png)
      setPdfOk(pdf)
    })()
    return () => {
      alive = false
    }
  }, [urls.pngUrl, urls.pdfUrl])

  const loading = pngOk === null || pdfOk === null
  const empty = !loading && !pngOk && !pdfOk

  const close = () => {
    window.close()
  }

  return (
    <div className="fiche-viewer">
      <header className="fiche-viewer__head">
        <div className="fiche-viewer__titles">
          <span className="fiche-viewer__code">{code}</span>
          {title ? <h1 className="fiche-viewer__title">{title}</h1> : null}
        </div>
        <PageCloseButton
          onClick={close}
          ariaLabel={t('fiche.closeAria')}
          className="fiche-viewer__close"
        />
      </header>

      <main className="fiche-viewer__body">
        {loading && (
          <p className="fiche-viewer__status muted">{t('fiche.loading')}</p>
        )}
        {empty && (
          <p className="fiche-viewer__status" role="status">
            {t('fiche.unavailable', { code })}
          </p>
        )}
        {pngOk && urls.pngUrl && (
          <section className="fiche-viewer__panel">
            <img
              className="fiche-viewer__png"
              src={urls.pngUrl}
              alt={t('fiche.pngAlt', { code })}
            />
          </section>
        )}
        {pdfOk && urls.pdfUrl && (
          <section className="fiche-viewer__panel">
            <iframe
              className="fiche-viewer__pdf"
              src={urls.pdfUrl}
              title={t('fiche.pdfAlt', { code })}
            />
          </section>
        )}
      </main>
    </div>
  )
}
