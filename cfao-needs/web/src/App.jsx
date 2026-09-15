import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'

import AppShell from './components/AppShell'
import BackToTopFab from './components/BackToTopFab'
import PortalLoader from './components/PortalLoader'
import ScrollToTop from './components/ScrollToTop'
import { SaveStatusProvider } from './components/SaveStatus'
import { Banner } from './components/ui'
import { LocaleProvider, useLocale } from './i18n'
import { api } from './lib/api'
import {
  consumeAuthReturnPath,
  handleCallback,
  isReviewer,
  login,
  readSession,
} from './lib/auth'
import BrandEntry from './pages/BrandEntry'
import FicheViewer from './pages/FicheViewer'
import Inbox from './pages/Inbox'
import Outbox from './pages/Outbox'
import Poles from './pages/Poles'
import Profile from './pages/Profile'
import Review from './pages/Review'

/** Campagne courante + mon Identification des Besoins + sections de marques — chargées au démarrage, partagées. */
const CampaignContext = createContext(null)
export const useCampaign = () => useContext(CampaignContext)

function CampaignProvider({ initialData, children }) {
  const [data, setData] = useState(initialData)

  const reload = useCallback(async () => {
    if (!data?.campaign) return
    const [submissionsRes, sectionsRes] = await Promise.all([
      api.submissions({ campaign: data.campaign.id }).catch(() => null),
      api.brands(data.campaign.id).catch(() => []),
    ])
    const mine = (submissionsRes?.results ?? submissionsRes ?? [])[0] ?? null
    const sections = sectionsRes?.results ?? sectionsRes ?? []
    setData((prev) => ({ ...prev, submission: mine, sections }))
  }, [data?.campaign])

  const ensureSubmission = useCallback(async () => {
    if (data?.submission) return data.submission
    const created = await api.createMySubmission(data.campaign.id)
    setData((prev) => ({ ...prev, submission: created }))
    return created
  }, [data?.campaign, data?.submission])

  return (
    <CampaignContext.Provider
      value={{
        ...data,
        reload,
        setData,
        ensureSubmission,
      }}
    >
      {children}
    </CampaignContext.Provider>
  )
}

function Authenticated({ session, initialCampaignData }) {
  const [pendingCount, setPendingCount] = useState(0)

  // Compteur de la file d'envoi — visible en permanence dans la navigation :
  // le circuit de relecture ne doit pas devenir un goulot silencieux.
  useEffect(() => {
    if (!isReviewer(session)) return undefined
    let alive = true
    const refresh = () =>
      api
        .outbound({ status: 'PENDING_REVIEW' })
        .then((res) => {
          if (!alive) return
          const rows = res?.results ?? res ?? []
          setPendingCount(rows.length)
        })
        .catch(() => {})
    refresh()
    const timer = setInterval(refresh, 60000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [session])

  return (
    <CampaignProvider initialData={initialCampaignData}>
      <SaveStatusProvider>
        <AppShell session={session} pendingCount={pendingCount}>
          <Routes>
            <Route path="/" element={<Poles />} />
            <Route path="/marque/:code" element={<BrandEntry />} />
            <Route path="/profil" element={<Profile session={session} />} />
            <Route path="/relecture" element={<Inbox />} />
            <Route path="/relecture/:id" element={<Review />} />
            <Route path="/a-envoyer" element={<Outbox onCountChange={setPendingCount} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      </SaveStatusProvider>
    </CampaignProvider>
  )
}

export default function App() {
  const [session, setSession] = useState(() => readSession())
  const [campaignData, setCampaignData] = useState(null)
  const [bootStatus, setBootStatus] = useState(() => {
    const path = window.location.pathname
    if (path.startsWith('/fiche/')) return 'ready'
    return 'loading'
  })
  const [bootError, setBootError] = useState(null)
  const [isLeaving, setIsLeaving] = useState(false)
  const navigate = useNavigate()

  const path = window.location.pathname
  const isFiche = path.startsWith('/fiche/')
  const isCallback = path === '/callback'

  useEffect(() => {
    if (isFiche) return

    let cancelled = false

    async function init() {
      try {
        let activeSession = session
        let returnPath = null

        // 1. Retour de Keycloak sur /callback : échanger le code contre un jeton
        if (isCallback) {
          activeSession = await handleCallback()
          if (cancelled) return
          setSession(activeSession)
          returnPath = consumeAuthReturnPath()
        }

        // 2. Si non authentifié (et hors /callback), rediriger vers Keycloak
        if (!activeSession) {
          login()
          return
        }

        // 3. Charger d'un seul coup toute la donnée requise pour l'affichage :
        //    Campagne active + soumission de l'utilisateur + catalogue des marques.
        //    Le loader reste CONTINU et UNIQUE jusqu'à ce que tout soit prêt.
        const campaigns = await api.campaigns()
        if (cancelled) return
        const list = campaigns?.results ?? campaigns ?? []
        const campaign = list.find((c) => c.status === 'OPEN') ?? list[0] ?? null

        let mine = null
        let sections = []
        if (campaign) {
          const [submissionsRes, sectionsRes] = await Promise.all([
            api.submissions({ campaign: campaign.id }).catch(() => null),
            api.brands(campaign.id).catch(() => []),
          ])
          if (cancelled) return
          mine = (submissionsRes?.results ?? submissionsRes ?? [])[0] ?? null
          sections = sectionsRes?.results ?? sectionsRes ?? []
        }

        if (cancelled) return
        setCampaignData({ campaign, submission: mine, sections })

        if (returnPath) {
          navigate(returnPath, { replace: true })
        }

        // 4. Transition fluide vers la page : animation de sortie du loader
        setIsLeaving(true)
        setTimeout(() => {
          if (!cancelled) {
            setBootStatus('ready')
            setIsLeaving(false)
          }
        }, 250)
      } catch (err) {
        if (!cancelled) {
          console.error('Initialisation failed:', err)
          setBootError(err)
          setBootStatus('error')
        }
      }
    }

    init()

    return () => {
      cancelled = true
    }
  }, []) // Initialisation unique au montage

  if (isFiche) {
    return (
      <LocaleProvider profileLocale={session?.claims?.locale}>
        <Routes>
          <Route path="/fiche/:code" element={<FicheViewer />} />
        </Routes>
      </LocaleProvider>
    )
  }

  if (bootStatus === 'error') {
    return (
      <LocaleProvider profileLocale={session?.claims?.locale}>
        <div style={{ padding: 32, maxWidth: 480, margin: '40px auto' }}>
          <Banner tone="crit" title="Authentification impossible">
            <p style={{ margin: '8px 0 16px' }}>
              Une erreur est survenue lors de l'accès à votre espace.
            </p>
            <button type="button" className="btn" onClick={() => login()}>
              Se reconnecter
            </button>
          </Banner>
        </div>
      </LocaleProvider>
    )
  }

  return (
    <LocaleProvider profileLocale={session?.claims?.locale}>
      <ScrollToTop />
      <BackToTopFab />
      {bootStatus === 'loading' && (
        <PortalLoader leaving={isLeaving} />
      )}
      {bootStatus === 'ready' && session && campaignData && (
        <Authenticated session={session} initialCampaignData={campaignData} />
      )}
    </LocaleProvider>
  )
}
