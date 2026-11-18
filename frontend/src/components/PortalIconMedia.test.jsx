import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import PortalIconMedia from './PortalIconMedia.jsx'

describe('PortalIconMedia', () => {
  it('teinte le visuel selon le statut et dessine l’icône demandée', () => {
    const html = renderToStaticMarkup(<PortalIconMedia icon="devis" tone="closed" />)
    expect(html).toContain('portal-icon-media--closed')
    expect(html.match(/<path /g)).toHaveLength(4)
  })

  it('sans statut, reste neutre', () => {
    expect(renderToStaticMarkup(<PortalIconMedia icon="besoins" />)).toContain('portal-icon-media--todo')
  })
})
