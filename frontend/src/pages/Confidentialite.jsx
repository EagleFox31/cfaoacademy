import SitePageLayout from '../components/SitePageLayout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import useLocale from '../hooks/useLocale.js'
import { PROCESSING_ROW_IDS } from '../i18n/privacy.js'

const ACADEMY_EMAIL = 'academy@cfaomobility.com'
const CFAO_GROUP_URL = 'https://www.cfao.com/'

function LegalBullets({ items }) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

export default function Confidentialite() {
  const { t } = useLocale('privacy')

  return (
    <SitePageLayout>
      <main>
        <PageHeader
          eyebrow={t.eyebrow}
          title={t.title}
          sub={t.sub}
          closeAria={t.closeAria}
        />

        <section className="legal-body">
          <div className="container">
            <div className="legal-content">

              <div className="legal-section">
                <h2>{t.scopeTitle}</h2>
                <p>{t.scopeP1}</p>
                <p>{t.scopeP2}</p>
                <LegalBullets items={t.scopeBullets} />
                <p>{t.scopeP3}</p>
              </div>

              <div className="legal-section">
                <h2>{t.controllerTitle}</h2>
                <p>{t.controllerP1}</p>
                <p>{t.controllerP2}</p>
                <p>
                  {t.controllerContactLabel}{' '}
                  <a href={`mailto:${ACADEMY_EMAIL}`}>{ACADEMY_EMAIL}</a>
                  <br />
                  {t.controllerCompliance}{' '}
                  <a href={CFAO_GROUP_URL} target="_blank" rel="noopener noreferrer">cfao.com</a>.
                </p>
              </div>

              <div className="legal-section">
                <h2>{t.subjectsTitle}</h2>
                <LegalBullets items={t.subjectsBullets} />
              </div>

              <div className="legal-section">
                <h2>{t.dataTitle}</h2>
                <p>{t.dataIntro}</p>
                <LegalBullets items={t.dataBullets} />
                <p>{t.dataOutro}</p>
              </div>

              <div className="legal-section">
                <h2>{t.tableTitle}</h2>
                <p>{t.tableIntro}</p>
                <div className="legal-table-wrap">
                  <table className="legal-table">
                    <thead>
                      <tr>
                        <th scope="col">{t.tablePurpose}</th>
                        <th scope="col">{t.tableLegal}</th>
                        <th scope="col">{t.tableRetention}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PROCESSING_ROW_IDS.map((id) => {
                        const row = t.processingRows[id]
                        return (
                          <tr key={id}>
                            <td>
                              <strong>{row.purpose}</strong> — {row.detail}
                            </td>
                            <td>{row.legal}</td>
                            <td>{row.retention}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="legal-section">
                <h2>{t.recipientsTitle}</h2>
                <p>{t.recipientsIntro}</p>
                <LegalBullets items={t.recipientsBullets} />
                <p>{t.recipientsOutro}</p>
              </div>

              <div className="legal-section">
                <h2>{t.transfersTitle}</h2>
                <p>{t.transfersP1}</p>
                <p>{t.transfersP2}</p>
              </div>

              <div className="legal-section">
                <h2>{t.rightsTitle}</h2>
                <p>{t.rightsIntro}</p>
                <LegalBullets items={t.rightsBullets} />
                <p>
                  {t.rightsExerciseBefore}{' '}
                  <a href={`mailto:${ACADEMY_EMAIL}`}>{ACADEMY_EMAIL}</a>{' '}
                  {t.rightsExerciseAfter}
                </p>
                <p>{t.rightsComplaint}</p>
              </div>

              <div className="legal-section">
                <h2>{t.cookiesTitle}</h2>
                <p>{t.cookiesIntro}</p>
                <LegalBullets items={t.cookiesBullets} />
                <p>{t.cookiesOutro}</p>
              </div>

              <div className="legal-section">
                <h2>{t.securityTitle}</h2>
                <p>{t.securityP1}</p>
              </div>

              <div className="legal-section">
                <h2>{t.updatesTitle}</h2>
                <p>{t.updatesP1}</p>
              </div>

              <div className="legal-section">
                <h2>{t.contactTitle}</h2>
                <p>
                  {t.contactP1Before}{' '}
                  <a href={`mailto:${ACADEMY_EMAIL}`}>{ACADEMY_EMAIL}</a>
                </p>
              </div>

            </div>
          </div>
        </section>
      </main>
    </SitePageLayout>
  )
}
