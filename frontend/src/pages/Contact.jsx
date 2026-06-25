import { useCallback, useEffect, useMemo, useState } from 'react'
import SitePageLayout from '../components/SitePageLayout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import PreviewSection from '../components/PreviewSection.jsx'
import FaqShowcase from '../components/FaqShowcase.jsx'
import SubjectCombobox from '../components/SubjectCombobox.jsx'
import PhoneInput from '../components/PhoneInput.jsx'
import FormAlert, { FormFieldError } from '../components/FormAlert.jsx'
import {
  getContactBranchOptions,
  getContactCountryOptions,
  getDialCodeForCountry,
  getContactCountryFlag,
  countryIdFromLabel,
  countryLabelFromId,
} from '../data/contactGeo.js'
import useLocale from '../hooks/useLocale.js'
import { sectionTitle } from '../utils/sectionTitle.jsx'
import Reveal from '../components/Reveal.jsx'
import {
  CONTACT_SUBJECT_KEYS,
  SUBJECT_OPTION_IDS,
} from '../i18n/contact.js'
import {
  CONTACT_SUCCESS_CODES,
  getContactMessage,
  validateContactForm,
} from '../utils/contactErrors.js'

const INITIAL_FORM = {
  name: '',
  email: '',
  organization: '',
  country: '',
  countryId: '',
  phoneDial: '',
  phone: '',
  subject: '',
  message: '',
}

export default function Contact() {
  const { locale, t } = useLocale('contact')
  const [form, setForm] = useState(INITIAL_FORM)
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [formSuccess, setFormSuccess] = useState(null)
  const [loading, setLoading] = useState(false)

  const subjectOptions = useMemo(
    () => SUBJECT_OPTION_IDS.map((id) => t[CONTACT_SUBJECT_KEYS[id]]),
    [t],
  )

  const branchOptions = useMemo(() => getContactBranchOptions(locale), [locale])

  const countryOptions = useMemo(
    () => getContactCountryOptions(locale).map((o) => o.label),
    [locale],
  )

  const resolveCountryFlag = useCallback(
    (label) => {
      const id = countryIdFromLabel(label, locale)
      return id ? getContactCountryFlag(id) : null
    },
    [locale],
  )

  const phoneFlag = useMemo(
    () => (form.countryId ? getContactCountryFlag(form.countryId) : null),
    [form.countryId],
  )

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
    setFormError(null)
    setFormSuccess(null)
  }

  const updateCountry = (label) => {
    const trimmed = label.trim()
    if (!trimmed) {
      setForm((prev) => ({
        ...prev,
        country: '',
        countryId: '',
        phoneDial: '',
      }))
    } else {
      const id = countryIdFromLabel(label, locale)
      setForm((prev) => ({
        ...prev,
        country: label,
        ...(id
          ? { countryId: id, phoneDial: getDialCodeForCountry(id) }
          : {}),
      }))
    }
    setFieldErrors((prev) => {
      if (!prev.country) return prev
      const next = { ...prev }
      delete next.country
      return next
    })
    setFormError(null)
    setFormSuccess(null)
  }

  useEffect(() => {
    setForm((prev) => {
      if (!prev.countryId) return prev
      const label = countryLabelFromId(prev.countryId, locale)
      return prev.country === label ? prev : { ...prev, country: label }
    })
  }, [locale])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFieldErrors({})
    setFormError(null)
    setFormSuccess(null)

    const result = validateContactForm(form)
    if (!result.ok) {
      setFieldErrors(result.fieldErrors)
      return
    }

    setLoading(true)
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 900))
      setFormSuccess(CONTACT_SUCCESS_CODES.MESSAGE_SENT)
      setForm(INITIAL_FORM)
    } catch {
      setFormError('NETWORK')
    } finally {
      setLoading(false)
    }
  }

  const msg = (code) => getContactMessage(code, locale)

  return (
    <SitePageLayout showCursorGlow>
      <PageHeader
        translucent
        eyebrow={t.formIx}
        title={sectionTitle(t.formTitleBefore, t.formTitleEm, t.formTitleAfter)}
        sub={t.formLead}
      />

      <section id="contact-form" className="tight section-anchor contact-page">
        <div className="container contact-page-inner">
          <Reveal>
            <div className="contact-shell contact-shell--form-only">
              <div className="contact-form-card glass-panel">
                <p className="contact-form-sub">{t.formRequiredNote}</p>

                <FormAlert type="error" message={formError ? msg(formError) : null} />
                <FormAlert type="success" message={formSuccess ? msg(formSuccess) : null} />

                <form className="contact-form" onSubmit={handleSubmit} noValidate>
                  <div className="contact-form-grid">
                    <div className="login-field">
                      <label className="login-label" htmlFor="contact-name">{t.nameLabel}</label>
                      <input
                        id="contact-name"
                        type="text"
                        className={`login-input${fieldErrors.name ? ' is-invalid' : ''}`}
                        value={form.name}
                        onChange={(e) => updateField('name', e.target.value)}
                        autoComplete="name"
                        aria-invalid={Boolean(fieldErrors.name)}
                        aria-describedby={fieldErrors.name ? 'contact-name-error' : undefined}
                        disabled={loading}
                      />
                      <FormFieldError
                        id="contact-name-error"
                        error={fieldErrors.name ? msg(fieldErrors.name) : null}
                      />
                    </div>

                    <div className="login-field">
                      <label className="login-label" htmlFor="contact-email">{t.emailLabel}</label>
                      <input
                        id="contact-email"
                        type="email"
                        className={`login-input${fieldErrors.email ? ' is-invalid' : ''}`}
                        value={form.email}
                        onChange={(e) => updateField('email', e.target.value)}
                        autoComplete="email"
                        aria-invalid={Boolean(fieldErrors.email)}
                        aria-describedby={fieldErrors.email ? 'contact-email-error' : undefined}
                        disabled={loading}
                      />
                      <FormFieldError
                        id="contact-email-error"
                        error={fieldErrors.email ? msg(fieldErrors.email) : null}
                      />
                    </div>
                  </div>

                  <SubjectCombobox
                    id="contact-organization"
                    label={t.organizationLabel}
                    placeholder={t.organizationPlaceholder}
                    options={branchOptions}
                    value={form.organization}
                    onChange={(value) => updateField('organization', value)}
                    disabled={loading}
                  />

                  <div className="contact-form-grid contact-form-grid--paired">
                    <SubjectCombobox
                      id="contact-country"
                      label={t.countryLabel}
                      describedBy="contact-country-hint"
                      placeholder={t.countryPlaceholder}
                      options={countryOptions}
                      value={form.country}
                      onChange={updateCountry}
                      resolveFlag={resolveCountryFlag}
                      disabled={loading}
                    />

                    <PhoneInput
                      id="contact-phone"
                      label={t.phoneLabel}
                      dialCode={form.phoneDial}
                      flag={phoneFlag}
                      value={form.phone}
                      onChange={(value) => updateField('phone', value)}
                      placeholder={t.phonePlaceholder}
                      disabled={loading}
                    />
                  </div>
                  <p className="contact-country-hint" id="contact-country-hint">{t.countryHint}</p>

                  <SubjectCombobox
                    id="contact-subject"
                    label={t.subjectLabel}
                    hint={t.subjectHint}
                    placeholder={t.subjectPlaceholder}
                    options={subjectOptions}
                    value={form.subject}
                    onChange={(value) => updateField('subject', value)}
                    invalid={Boolean(fieldErrors.subject)}
                    errorId={fieldErrors.subject ? 'contact-subject-error' : undefined}
                    disabled={loading}
                  />
                  <FormFieldError
                    id="contact-subject-error"
                    error={fieldErrors.subject ? msg(fieldErrors.subject) : null}
                  />

                  <div className="login-field">
                    <label className="login-label" htmlFor="contact-message">{t.messageLabel}</label>
                    <textarea
                      id="contact-message"
                      className={`login-input login-textarea${fieldErrors.message ? ' is-invalid' : ''}`}
                      rows={6}
                      value={form.message}
                      onChange={(e) => updateField('message', e.target.value)}
                      aria-invalid={Boolean(fieldErrors.message)}
                      aria-describedby={fieldErrors.message ? 'contact-message-error' : undefined}
                      disabled={loading}
                    />
                    <FormFieldError
                      id="contact-message-error"
                      error={fieldErrors.message ? msg(fieldErrors.message) : null}
                    />
                  </div>

                  <button type="submit" className="btn btn-primary contact-submit" disabled={loading}>
                    {loading ? t.submitting : t.submit}
                    {!loading && <span className="arrow">→</span>}
                  </button>
                </form>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <PreviewSection
        ix={t.faqIx}
        title={sectionTitle(t.faqTitleBefore, t.faqTitleEm, t.faqTitleAfter)}
        headClass="pv-head--compact-line"
        bgWord="faq"
        bgWordSide="right"
      >
        <FaqShowcase />
      </PreviewSection>

    </SitePageLayout>
  )
}
