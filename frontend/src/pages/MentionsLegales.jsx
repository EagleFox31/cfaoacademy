import { Link } from 'react-router-dom'
import SitePageLayout from '../components/SitePageLayout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import useLocale from '../hooks/useLocale.js'
import { LEGAL_EDITOR_FIELD_IDS } from '../i18n/legal.js'

const ACADEMY_EMAIL = 'academy@cfaomobility.com'
const AZURE_URL = 'https://azure.microsoft.com'

function LegalBullets({ items }) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

export default function MentionsLegales() {
  const { t } = useLocale('legal')
  const fields = t.editorFields

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
                <h2>{t.editorTitle}</h2>
                <p>{t.editorIntro}</p>
                <ul>
                  {LEGAL_EDITOR_FIELD_IDS.map((id) => (
                    <li key={id}>
                      {id === 'contact' ? (
                        <>
                          <strong>{fields.contact}</strong>{' '}
                          <a href={`mailto:${ACADEMY_EMAIL}`}>{ACADEMY_EMAIL}</a>
                        </>
                      ) : (
                        fields[id]
                      )}
                    </li>
                  ))}
                </ul>
                <p>{t.editorAccuracy}</p>
              </div>

              <div className="legal-section">
                <h2>{t.conceptionTitle}</h2>
                <p>{t.conceptionP1}</p>
                <p>{t.conceptionP2}</p>
              </div>

              <div className="legal-section">
                <h2>{t.natureTitle}</h2>
                <p>{t.natureP1}</p>
                <p>{t.natureP2}</p>
                <LegalBullets items={t.natureBullets} />
                <p>{t.natureP3}</p>
              </div>

              <div className="legal-section">
                <h2>{t.hostingTitle}</h2>
                <p>{t.hostingP1}</p>
                <ul>
                  {t.hostingBullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                  <li>
                    {t.hostingWebLabel}{' '}
                    <a href={AZURE_URL} target="_blank" rel="noopener noreferrer">{t.hostingWebText}</a>
                  </li>
                </ul>
              </div>

              <div className="legal-section">
                <h2>{t.ipTitle}</h2>
                <p>{t.ipP1}</p>
                <p>{t.ipP2}</p>
                <p>{t.ipP3}</p>
                <p>{t.ipP4}</p>
              </div>

              <div className="legal-section">
                <h2>{t.brandsTitle}</h2>
                <p>{t.brandsP1}</p>
                <p>{t.brandsP2}</p>
              </div>

              <div className="legal-section">
                <h2>{t.creditsTitle}</h2>
                <p>{t.creditsP1}</p>
              </div>

              <div className="legal-section">
                <h2>{t.liabilityTitle}</h2>
                <p>{t.liabilityIntro}</p>
                <LegalBullets items={t.liabilityBullets} />
              </div>

              <div className="legal-section">
                <h2>{t.linksTitle}</h2>
                <p>{t.linksP1}</p>
                <p>
                  {t.linksP2Before}{' '}
                  <Link to="/confidentialite">{t.linksPrivacyLabel}</Link>.
                  {' '}{t.linksP2After}
                </p>
              </div>

              <div className="legal-section">
                <h2>{t.lawTitle}</h2>
                <p>{t.lawP1}</p>
                <p>{t.lawP2}</p>
              </div>

              <div className="legal-section">
                <h2>{t.contactTitle}</h2>
                <p>
                  {t.contactP1Before}{' '}
                  <a href={`mailto:${ACADEMY_EMAIL}`}>{ACADEMY_EMAIL}</a>
                </p>
              </div>

              <p className="legal-copyright">{t.copyright}</p>

            </div>
          </div>
        </section>
      </main>
    </SitePageLayout>
  )
}
