import Reveal from './Reveal.jsx'

/** Section portail — entrée au scroll (fade + translateY). */
export default function PortalReveal({ className = '', as = 'section', ...rest }) {
  return (
    <Reveal
      as={as}
      className={`portal-reveal ${className}`.trim()}
      rootMargin="0px 0px -5% 0px"
      threshold={0.12}
      {...rest}
    />
  )
}
