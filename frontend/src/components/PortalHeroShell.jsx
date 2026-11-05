/** Shell hero portail — orbes, grille texte + panneau latéral optionnel. */
export default function PortalHeroShell({ aside, children, className = '' }) {
  return (
    <section
      id="portail-hero"
      className={`page-header portal-page-header${aside ? ' portal-page-header--with-cert' : ''}${className ? ` ${className}` : ''}`}
    >
      <div className="portal-hero-fx" aria-hidden="true">
        <span className="portal-hero-orb portal-hero-orb--a parallax" data-speed="0.08" />
        <span className="portal-hero-orb portal-hero-orb--b parallax" data-speed="0.16" />
      </div>
      <div className="container portal-header-container">
        {children}
        {aside}
      </div>
    </section>
  )
}
