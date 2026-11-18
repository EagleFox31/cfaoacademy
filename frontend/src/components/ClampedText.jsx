/**
 * Texte limité à `lines` lignes (3 par défaut) avec points de suspension.
 * Au survol, si le texte est réellement coupé, l'infobulle native montre le
 * texte complet (contenu texte du nœud, donc aussi quand `children` est un
 * fragment JSX). Les règles CSS plus précises qui fixent un autre
 * `-webkit-line-clamp` restent prioritaires.
 */
export default function ClampedText({ as: Tag = 'p', lines = 3, className = '', style, children, ...rest }) {
  const signalerCoupure = e => {
    const el = e.currentTarget
    const coupe = el.scrollHeight > el.clientHeight + 1
    const texte = coupe ? el.textContent.trim() : ''
    if (texte) el.setAttribute('title', texte)
    else el.removeAttribute('title')
  }
  return (
    <Tag
      {...rest}
      className={`clamp-lines${className ? ` ${className}` : ''}`}
      style={{ '--clamp-lines': lines, ...style }}
      onMouseEnter={signalerCoupure}
    >
      {children}
    </Tag>
  )
}
