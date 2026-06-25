import { useEffect, useState } from 'react'
import { LOGO_CFAO_EQUIPMENT, LOGO_EQUIPMENT } from '../utils/resolveDetailCfaoLogo.js'

export default function DetailHeaderLogos({ cfaoLogo, brandLogo, brandLabel }) {
  const [cfaoSrc, setCfaoSrc] = useState(cfaoLogo)

  useEffect(() => {
    setCfaoSrc(cfaoLogo)
  }, [cfaoLogo])

  function onCfaoError() {
    if (cfaoSrc === LOGO_EQUIPMENT) setCfaoSrc(LOGO_CFAO_EQUIPMENT)
  }

  return (
    <div className="article-header-logos" aria-hidden="true">
      <img
        src={cfaoSrc}
        alt=""
        className="article-header-logo article-header-logo--cfao"
        onError={onCfaoError}
      />
      {brandLogo ? (
        <img src={brandLogo} alt="" className="article-header-logo article-header-logo--brand" />
      ) : brandLabel ? (
        <span className="article-header-brand-label">{brandLabel}</span>
      ) : null}
    </div>
  )
}
