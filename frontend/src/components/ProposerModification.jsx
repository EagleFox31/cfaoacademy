import { useEffect, useId, useRef, useState } from 'react'
import useLocale from '../hooks/useLocale'
import { api } from '../lib/api'
import { PROPOSITION_CREEE, TYPE_MAX, TYPES_PROPOSITION, typeDepuisSaisie, typesLibres } from '../utils/typesProposition.js'
import ListePropositions from './ListePropositions.jsx'

/** Comptes qui peuvent proposer une modification (même liste que la politique Cerbos portal_suggestion). */
const PROPOSANTS = new Set(['center_director', 'superadmin'])
export const peutProposer = (roles = []) => (roles ?? []).some(r => PROPOSANTS.has(r))

const MIN = 10
const MAX = 2000
/** Propositions de l'auteur affichées sous le formulaire (les plus récentes). */
const MIENNES_VISIBLES = 5

/** Chemin de la page, au format accepté par le serveur (lettres, chiffres, - _ /). */
export function cheminPage(pathname = '/') {
  const propre = String(pathname || '/').replace(/[^\w\-/]/g, '-').slice(0, 200)
  return propre.startsWith('/') ? propre : `/${propre}`.slice(0, 200)
}

/** Titres des parties réellement affichées sur la page (jamais inventés). */
export function partiesDeLaPage(doc = document) {
  const vus = new Set()
  for (const h of doc.querySelectorAll('main h2')) {
    const texte = h.textContent.replace(/\s+/g, ' ').trim().slice(0, 120)
    if (texte) vus.add(texte)
  }
  return [...vus]
}

/** Dernière vignette cliquée dans le portail : retrouvée sur la page où elle mène. */
const ORIGINE = 'cfao-apercu-origine'
const court = (texte, max) => {
  const propre = String(texte ?? '').replace(/\s+/g, ' ').trim()
  return propre.length > max ? `${propre.slice(0, max - 1)}…` : propre
}

export function retenirOrigine(e, win = window) {
  const lien = e.target?.closest?.('main a[href]')
  if (!lien) return
  let cible
  try { cible = new URL(lien.getAttribute('href'), win.location.href) } catch { return }
  if (cible.origin !== win.location.origin || cible.pathname === win.location.pathname) return
  const carte = lien.closest('.portal-card-anchor, article, [class*="card"]')
  const vignette = court(carte?.querySelector('h3')?.textContent, 50)
  try {
    if (vignette) win.sessionStorage.setItem(ORIGINE, JSON.stringify({ chemin: cible.pathname, vignette }))
  } catch { /* stockage indisponible : pas de contexte, sans gêne */ }
}

/**
 * Libellé « toute la page » rendu précis : la vignette d'où l'on vient et le
 * titre de la page (ex. Vignette « Devis 2027 » → page « Devis »). Jamais inventé.
 */
export function libelleToutePage(t, doc = document, win = window) {
  const page = court(doc.querySelector('main h1, h1')?.textContent, 50)
  let vignette = ''
  try {
    const o = JSON.parse(win.sessionStorage.getItem(ORIGINE) || 'null')
    if (o?.chemin === win.location.pathname) vignette = court(o.vignette, 50)
  } catch { /* rien */ }
  if (vignette && page) return t.apercu_proposer_depuis_vignette.replace('{vignette}', vignette).replace('{page}', page)
  if (page) return t.apercu_proposer_page.replace('{page}', page)
  return ''
}

/**
 * Liste de choix avec saisie libre (motif ARIA « combobox »), au style du
 * panneau : la liste native (datalist) prend le thème du système et ne se
 * style pas. Flèches, Entrée et Échap au clavier ; la liste se filtre sur
 * le texte saisi, sauf s'il est déjà un des choix.
 */
function ChoixType({ id, t, valeur, onChange, options }) {
  const [ouverte, setOuverte] = useState(false)
  const [active, setActive] = useState(-1)
  const champ = useRef(null)
  const cle = valeur.trim().toLocaleLowerCase()
  const exacte = options.some(o => o.toLocaleLowerCase() === cle)
  const visibles = cle && !exacte ? options.filter(o => o.toLocaleLowerCase().includes(cle)) : options
  const liste = `${id}-liste`

  const choisir = o => {
    onChange(o)
    setOuverte(false)
    setActive(-1)
  }

  const clavier = e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!ouverte) { setOuverte(true); setActive(0); return }
      const pas = e.key === 'ArrowDown' ? 1 : -1
      setActive(i => (visibles.length ? (i + pas + visibles.length) % visibles.length : -1))
    } else if (e.key === 'Enter' && ouverte && visibles[active]) {
      e.preventDefault()
      choisir(visibles[active])
    } else if (e.key === 'Escape' && ouverte) {
      e.stopPropagation()
      setOuverte(false)
    }
  }

  return (
    <div className="portal-apercu-choix">
      <input ref={champ} id={id} type="text" role="combobox" value={valeur} maxLength={TYPE_MAX}
        autoComplete="off" placeholder={t.apercu_proposer_type_aide}
        aria-expanded={ouverte} aria-controls={liste} aria-autocomplete="list"
        aria-activedescendant={ouverte && visibles[active] ? `${liste}-${active}` : undefined}
        onChange={e => { onChange(e.target.value); setOuverte(true); setActive(-1) }}
        onClick={() => setOuverte(true)}
        onBlur={() => setOuverte(false)}
        onKeyDown={clavier} />
      <button type="button" className="portal-apercu-choix-fleche" tabIndex={-1} aria-label={t.apercu_proposer_type_liste}
        onMouseDown={e => e.preventDefault()}
        onClick={() => { setOuverte(o => !o); champ.current?.focus() }}>
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {ouverte && visibles.length > 0 && (
        <ul id={liste} role="listbox" className="portal-apercu-choix-liste">
          {visibles.map((o, i) => (
            <li key={o} id={`${liste}-${i}`} role="option" aria-selected={o.toLocaleLowerCase() === cle}
              className={i === active ? 'is-active' : undefined}
              onMouseDown={e => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => choisir(o)}>
              {o}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Bouton du bandeau d'aperçu : un petit panneau pour écrire ce qu'on veut
 * changer sur ce portail. La proposition part avec l'identité réelle du compte
 * (pas le « vu comme ») et arrive dans le portail du superadmin. Sous le
 * formulaire, l'auteur retrouve ses propositions et leur suivi.
 */
export default function ProposerModification({ role }) {
  const { t, locale } = useLocale('portal')
  const [ouvert, setOuvert] = useState(false)
  const [parties, setParties] = useState([])
  const [partie, setPartie] = useState('')
  const [toutePage, setToutePage] = useState('')
  const [saisieType, setSaisieType] = useState('')
  const [message, setMessage] = useState('')
  const [etat, setEtat] = useState(null) // null | 'envoi' | 'ok' | 'refus' | 'trop' | 'erreur'
  const [miennes, setMiennes] = useState(null) // null tant que non chargées (ou indisponibles)
  const bouton = useRef(null)
  const zone = useRef(null)
  const id = useId()

  useEffect(() => {
    if (ouvert) zone.current?.focus()
  }, [ouvert])

  useEffect(() => {
    document.addEventListener('click', retenirOrigine, true)
    return () => document.removeEventListener('click', retenirOrigine, true)
  }, [])

  useEffect(() => {
    if (!ouvert) return undefined
    let actif = true
    api.suggestions.miennes()
      .then(liste => { if (actif) setMiennes(Array.isArray(liste) ? liste : []) })
      .catch(() => { if (actif) setMiennes(null) })
    return () => { actif = false }
  }, [ouvert])

  const ouvrir = () => {
    const precis = libelleToutePage(t)
    setParties(partiesDeLaPage())
    setToutePage(precis)
    setPartie(precis)
    setEtat(null)
    setOuvert(true)
  }
  const fermer = () => {
    setOuvert(false)
    bouton.current?.focus()
  }

  const texte = message.trim()
  const valide = texte.length >= MIN && texte.length <= MAX
  const type = typeDepuisSaisie(saisieType, t)
  const exemple = (TYPES_PROPOSITION.includes(type) && t[`proposition_exemple_${type}`]) || t.apercu_proposer_exemple

  async function envoyer(e) {
    e.preventDefault()
    if (!valide || etat === 'envoi') return
    setEtat('envoi')
    try {
      const creee = await api.suggestions.creer({
        role_vu: role,
        chemin: cheminPage(window.location.pathname),
        section: partie,
        type,
        message: texte,
        langue: ['fr', 'en', 'pt'].includes(locale) ? locale : 'fr',
      })
      setMessage('')
      setSaisieType('')
      setEtat('ok')
      if (creee?.id) setMiennes(ls => [creee, ...(ls ?? [])])
      window.dispatchEvent(new Event(PROPOSITION_CREEE))
    } catch (err) {
      setEtat(err?.status === 403 ? 'refus' : err?.status === 429 ? 'trop' : 'erreur')
    }
  }

  const retour = {
    ok: t.apercu_proposer_ok,
    refus: t.apercu_proposer_refus,
    trop: t.apercu_proposer_trop,
    erreur: t.apercu_proposer_erreur,
  }[etat]

  return (
    <>
      <button ref={bouton} type="button" className="portal-btn portal-btn-primary portal-apercu-proposer"
        aria-expanded={ouvert} aria-controls={id} onClick={() => (ouvert ? fermer() : ouvrir())}>
        {t.apercu_proposer}
      </button>
      {ouvert && (
        <div id={id} className="portal-apercu-proposition" role="dialog" aria-labelledby={`${id}-titre`}
          onKeyDown={e => { if (e.key === 'Escape') fermer() }}>
          <form onSubmit={envoyer}>
            <h2 id={`${id}-titre`}>{t.apercu_proposer_titre}</h2>
            <p className="portal-apercu-proposition-contexte">
              {t.apercu_proposer_portail} <strong>{t[`role_${role}`] ?? role}</strong>
            </p>
            <label htmlFor={`${id}-partie`}>{t.apercu_proposer_partie}</label>
            <select id={`${id}-partie`} value={partie} onChange={e => setPartie(e.target.value)}>
              <option value={toutePage}>{toutePage || t.apercu_proposer_toute_page}</option>
              {parties.filter(p => p !== toutePage).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <label htmlFor={`${id}-type`}>{t.apercu_proposer_type}</label>
            <ChoixType id={`${id}-type`} t={t} valeur={saisieType} onChange={setSaisieType}
              options={[...TYPES_PROPOSITION.map(c => t[`proposition_type_${c}`]), ...typesLibres(miennes)]} />
            <label htmlFor={`${id}-message`}>{t.apercu_proposer_message}</label>
            <textarea ref={zone} id={`${id}-message`} rows={5} maxLength={MAX} value={message}
              placeholder={exemple}
              onChange={e => { setMessage(e.target.value); if (etat !== 'envoi') setEtat(null) }} />
            <p className="portal-apercu-proposition-aide">{t.apercu_proposer_aide.replace('{min}', MIN)}</p>
            {retour && (
              <p className={`portal-apercu-proposition-retour${etat === 'ok' ? ' is-ok' : ''}`} role="status">{retour}</p>
            )}
            <div className="portal-apercu-proposition-actions">
              <button type="button" className="portal-btn portal-btn-ghost" onClick={fermer}>{t.apercu_proposer_fermer}</button>
              <button type="submit" className="portal-btn portal-btn-primary" disabled={!valide || etat === 'envoi'}>
                {etat === 'envoi' ? t.apercu_proposer_envoi : t.apercu_proposer_envoyer}
              </button>
            </div>
          </form>
          {miennes?.length > 0 && (
            <section className="portal-apercu-miennes" aria-labelledby={`${id}-miennes`} data-testid="mes-propositions">
              <h3 id={`${id}-miennes`}>{t.apercu_miennes_titre}</h3>
              <ListePropositions propositions={miennes} t={t} locale={locale} max={MIENNES_VISIBLES} />
            </section>
          )}
        </div>
      )}
    </>
  )
}
