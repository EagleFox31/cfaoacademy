import PageCloseButton from './PageCloseButton.jsx'
import useAdaptiveFabTone from '../hooks/useAdaptiveFabTone.js'

/** Croix sticky des pages intérieures — ton adaptatif au scroll (comme BackToTopFab). */
export default function PageHeaderClose({ ariaLabel, to, onClick, fallbackTo }) {
  const tone = useAdaptiveFabTone('.page-header-close')

  const className = [
    'page-header-close',
    tone === 'dark' && 'page-header-close--on-dark',
  ].filter(Boolean).join(' ')

  return (
    <PageCloseButton
      ariaLabel={ariaLabel}
      className={className}
      to={to}
      onClick={onClick}
      fallbackTo={fallbackTo}
    />
  )
}
