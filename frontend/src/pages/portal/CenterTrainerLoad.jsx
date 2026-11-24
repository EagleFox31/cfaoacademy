import { useEffect, useState } from 'react'
import PortalReveal from '../../components/PortalReveal.jsx'
import PortalStaggerGrid from '../../components/PortalStaggerGrid.jsx'
import PortalSectionSkeleton from '../../components/PortalSectionSkeleton.jsx'
import PvCard from '../../components/PvCard'
import PortalIconMedia from '../../components/PortalIconMedia.jsx'
import PortalCardKpis from '../../components/PortalCardKpis.jsx'
import PortalModal from '../../components/PortalModal.jsx'
import CardMemberTitle from '../../components/CardMemberTitle.jsx'
import useLocale from '../../hooks/useLocale.js'
import { planningApi } from '../../lib/planningApi.js'
import { resolveCardBrandBadge } from '../../utils/cardBrandBadge.js'
import { trainerPhoto } from '../../utils/trainerPhoto.js'

const remplir = (texte, valeurs) =>
  Object.entries(valeurs).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v), texte ?? '')

/** Une année montre des charges dès qu'un formateur y a au moins une session. */
const affectee = charge => (charge?.trainers ?? []).some(f => f.sessions_count > 0)

/**
 * Année à afficher : la plus récente où des formateurs sont affectés. Les années
 * plus récentes, encore sans formateur, sont signalées par leur nombre de sessions.
 * `charges` est trié de la plus récente à la plus ancienne.
 */
export function choisirAnnee(charges) {
  const lisibles = charges.filter(Boolean)
  if (!lisibles.length) return null
  const retenue = lisibles.find(affectee) ?? lisibles[0]
  const enAttente = lisibles
    .filter(c => c.year > retenue.year && c.unassigned_sessions > 0)
    .map(c => ({ annee: c.year, sessions: c.unassigned_sessions }))
  if (retenue.unassigned_sessions > 0 && affectee(retenue)) {
    enAttente.push({ annee: retenue.year, sessions: retenue.unassigned_sessions })
  }
  return { charge: retenue, enAttente }
}

/** Pastille d'un formateur : rythme tenu, sessions rapprochées, ou aucune session. */
export function pastilleRythme(f, t) {
  if (!f.sessions_count) return { chip: 'todo', texte: t.dir_formateurs_chip_none }
  if (f.close_sessions > 0) {
    return { chip: 'alert', texte: remplir(t.dir_formateurs_chip_close, { n: f.close_sessions }) }
  }
  return { chip: 'done', texte: t.dir_formateurs_chip_ok }
}

function useCharge(annees) {
  const [etat, setEtat] = useState({ statut: 'chargement' })
  const cle = annees.join(',')

  useEffect(() => {
    if (!annees.length) return undefined
    let actif = true
    Promise.all(annees.map(a => planningApi.trainerLoad(a).catch(e => (e?.status === 403 ? 'interdit' : null))))
      .then(charges => {
        if (!actif) return
        if (charges.every(c => c === 'interdit')) return setEtat({ statut: 'interdit' })
        const choix = choisirAnnee(charges.filter(c => c && c !== 'interdit'))
        setEtat(choix ? { statut: 'pret', ...choix } : { statut: 'erreur' })
      })
    return () => { actif = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle])

  return etat
}

function SessionsFormateur({ f, annee, t, onClose }) {
  const { locale } = useLocale('common')
  const jour = d => new Date(`${d}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
  const dates = s => {
    if (!s.start_date) return t.dir_formateurs_no_date
    return s.end_date && s.end_date !== s.start_date ? `${jour(s.start_date)} – ${jour(s.end_date)}` : jour(s.start_date)
  }

  return (
    <PortalModal title={remplir(t.dir_formateurs_modal_title, { year: annee, name: f.name })} onClose={onClose}>
      <div className="portal-table-wrap">
        <table className="portal-table">
          <thead>
            <tr>
              <th>{t.dir_formateurs_col_dates}</th>
              <th>{t.dir_formateurs_col_training}</th>
              <th>{t.dir_formateurs_col_country}</th>
              <th>{t.dir_formateurs_col_days}</th>
            </tr>
          </thead>
          <tbody>
            {f.sessions.map(s => {
              const logo = resolveCardBrandBadge(s.brand).logo
              return (
                <tr key={s.id} className={s.close ? 'portal-table-alert' : undefined}>
                  <td>
                    {dates(s)}
                    {s.close && (
                      <span className="portal-status-chip alert" title={t.dir_formateurs_close}>
                        {t.dir_formateurs_close_chip}
                      </span>
                    )}
                  </td>
                  <td>
                    {logo ? <img className="sheet-c-logo" src={logo} alt={s.brand} /> : s.brand}
                    {' '}{s.code}{s.title ? ` · ${s.title}` : ''}
                  </td>
                  <td>{s.country_label}</td>
                  <td>{s.days}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </PortalModal>
  )
}

/**
 * Charge des formateurs, pour le directeur du centre : une carte par formateur
 * actif, du plus chargé au moins chargé. Absente pour un profil sans droit.
 */
export default function CenterTrainerLoad({ t, annees, statutAnnees }) {
  const charge = useCharge(annees)
  // Sans clé de répartition, il n'y a pas d'année à lire : on le dit au lieu d'attendre.
  const etat = statutAnnees === 'vide' ? { statut: 'pret', charge: null, enAttente: [] }
    : statutAnnees === 'erreur' ? { statut: 'erreur' }
      : charge
  const { locale } = useLocale('common')
  const [ouvert, setOuvert] = useState(null)

  if (etat.statut === 'interdit') return null
  const annee = etat.charge?.year ?? annees[0] ?? new Date().getFullYear()
  const formateurs = etat.charge?.trainers ?? []
  const prochaine = n => (n
    ? `${new Date(`${n.start_date}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}, ${n.country_label}`
    : t.dir_formateurs_next_none)

  return (
    <PortalReveal id="formateurs">
      <div className="container" style={{ padding: '16px 32px' }}>
        <div className="portal-section-head">
          <p className="portal-section-eyebrow">{t.dir_formateurs_eyebrow}</p>
          <h2 className="portal-section-title">{remplir(t.dir_formateurs_title, { year: annee })}</h2>
        </div>
        {etat.statut === 'chargement' && <PortalSectionSkeleton cols={4} count={4} ariaLabel={t.loading_cards} />}
        {etat.statut === 'erreur' && <p className="portal-empty-panel">{t.load_error}</p>}
        {etat.statut === 'pret' && (
          <>
            {etat.enAttente.map(a => (
              <p key={a.annee} className="portal-empty-panel">
                {remplir(t.dir_formateurs_unassigned, { n: a.sessions, year: a.annee })}
              </p>
            ))}
            {!affectee(etat.charge) && <p className="portal-empty-panel">{t.dir_formateurs_empty}</p>}
            <PortalStaggerGrid className="pv-grid--rail pv-grid--stretch">
              {formateurs.map(f => {
                const rythme = pastilleRythme(f, t)
                return (
                  <div key={f.id} className="portal-card-anchor">
                    <PvCard
                      className="portal-team-member-card"
                      cardMedia={<PortalIconMedia icon="formateur" tone={rythme.chip} />}
                      kicker={(
                        <span className="pv-card-kicker-row">
                          <span className={`portal-status-chip ${rythme.chip}`}>{rythme.texte}</span>
                          <span className="portal-status-chip todo">{f.service_label}</span>
                        </span>
                      )}
                      title={<CardMemberTitle name={f.name} avatarSrc={trainerPhoto(f.name)} />}
                      meta={(
                        <>
                          <PortalCardKpis
                            items={[
                              { value: f.days, label: t.dir_formateurs_kpi_days },
                              { value: f.sessions_count, label: t.dir_formateurs_kpi_sessions },
                            ]}
                          />
                          <PortalCardKpis items={[{ value: prochaine(f.next_session), label: t.dir_formateurs_kpi_next }]} />
                        </>
                      )}
                      {...(f.sessions_count
                        ? { onClick: () => setOuvert(f), cta: t.dir_formateurs_cta, hoverHint: t.dir_formateurs_cta }
                        : {})}
                      corner
                    />
                  </div>
                )
              })}
            </PortalStaggerGrid>
          </>
        )}
      </div>
      {ouvert && <SessionsFormateur f={ouvert} annee={annee} t={t} onClose={() => setOuvert(null)} />}
    </PortalReveal>
  )
}
