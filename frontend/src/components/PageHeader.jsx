import PageHeaderClose from './PageHeaderClose.jsx'

/**
 * Header compact pour toutes les pages intérieures (hors accueil).
 * Participe au zebra alternance — toujours première section de la page.
 */
export default function PageHeader({ eyebrow, title, sub, showClose = true, closeAria = 'Retour à la page précédente', translucent = false }) {
  return (
    <>
      {/* Hors du <section> : backdrop-filter du header casse position:fixed sinon */}
      {showClose && <PageHeaderClose ariaLabel={closeAria} />}
      <section className={`page-header${translucent ? ' page-header--translucent' : ''}`}>
        <div className="container">
          <div className="page-header-card">
            {eyebrow && <p className="page-header-eyebrow">{eyebrow}</p>}
            <h1 className="page-header-title">{title}</h1>
            {sub && <p className="page-header-sub">{sub}</p>}
          </div>
        </div>
      </section>
    </>
  )
}
