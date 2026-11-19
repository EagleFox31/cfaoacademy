import { Link } from 'react-router-dom'
import { PendingAction } from './AdminState'
import { ARTICLES } from '../../../../data/articles/index.js'
import { articleLocales } from '../../../../utils/articleAdmin'
import { plural } from '../../../../utils/adminAccounts'
import { localizedArticleCardBadge, localizedArticleFields } from '../../../../utils/localizeCard'

const LANGS = ['fr', 'en', 'pt']

export function BrandCell({ article, locale }) {
  const badge = localizedArticleCardBadge(article, locale)
  if (badge.logo) {
    return <span className="adm-brand"><img src={badge.logo} alt={badge.label ?? article.brand ?? ''} /></span>
  }
  return <span className="adm-brand">{badge.label}</span>
}

export default function ArticlesModule({ t, locale }) {
  return (
    <>
      <div className="dlv-toolbar">
        <span className="adm-muted">{plural(t, 'count_articles', ARTICLES.length)}</span>
        <span className="adm-actions"><PendingAction label={t.action_new_article} t={t} /></span>
      </div>
      <div className="adm-scroll">
        <table className="dlv-table">
          <thead>
            <tr>
              <th>{t.col_date}</th><th>{t.col_category}</th><th>{t.col_brand}</th>
              <th>{t.col_title}</th><th>{t.col_languages}</th><th aria-label={t.action_open} />
            </tr>
          </thead>
          <tbody>
            {ARTICLES.map(a => {
              const f = localizedArticleFields(a, locale)
              const langs = articleLocales(a.slug)
              return (
                <tr key={a.slug}>
                  <td>{f.dateLabel}</td>
                  <td>{f.categoryLabel}</td>
                  <td><BrandCell article={a} locale={locale} /></td>
                  <td>{f.title}</td>
                  <td>
                    <span className="adm-tags">
                      {LANGS.map(l => (
                        <span key={l} className={`adm-lang ${langs[l] ? '' : 'is-missing'}`}
                          title={langs[l] ? undefined : t.lang_missing.replace('{lang}', t[`lang_${l}`])}>
                          {t[`lang_${l}`]}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td><Link to={`/actualites/${a.slug}`} className="dlv-btn">{t.action_open}</Link></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
