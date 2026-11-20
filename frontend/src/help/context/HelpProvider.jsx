import { useCallback, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import useAuth from '../../hooks/useAuth.js'
import useLocale from '../../hooks/useLocale.js'
import { getPrimaryRole } from '../../data/index.js'
import { getHelpCopy } from '../i18n.js'
import {
  filterHelpArticles,
  getContextualHelpArticles,
  getHelpArticle,
  HELP_TOPICS,
} from '../articles/index.js'
import { resolveHelpContext } from '../context/routes.js'
import { searchHelpArticles, rankHelpArticles } from '../search.js'
import { HELP_TOUR_IDS, listHelpTours } from '../tours/index.js'
import { HelpContext } from './helpContext.js'

export function HelpProvider({
  children,
  onStartFullTour,
  onContactExpert,
  initialOpen = false,
}) {
  const { user } = useAuth()
  const { locale } = useLocale()
  const { t: portalCopy } = useLocale('portal')
  const location = useLocation()
  const [open, setOpen] = useState(initialOpen)
  const [query, setQuery] = useState('')
  const [activeTopic, setActiveTopic] = useState(null)
  const [activeArticleId, setActiveArticleId] = useState(null)

  const copy = useMemo(() => getHelpCopy(locale), [locale])
  const role = useMemo(() => (user ? getPrimaryRole(user.roles) : 'learner'), [user])
  const contextKey = useMemo(
    () => resolveHelpContext({ pathname: location.pathname, hash: location.hash }),
    [location.pathname, location.hash],
  )

  const contextualArticles = useMemo(
    () => getContextualHelpArticles({ locale, role, contextKey }),
    [locale, role, contextKey],
  )

  const searchResults = useMemo(() => {
    if (!query.trim()) return []
    return searchHelpArticles({ locale, role, query })
  }, [locale, role, query])

  const catalogArticles = useMemo(() => {
    const base = filterHelpArticles({ locale, role, topic: activeTopic || undefined })
    return rankHelpArticles(base, contextKey)
  }, [locale, role, activeTopic, contextKey])

  const activeArticle = useMemo(
    () => (activeArticleId ? getHelpArticle(activeArticleId, locale) : null),
    [activeArticleId, locale],
  )

  const tours = useMemo(
    () => listHelpTours(user, portalCopy),
    [user, portalCopy],
  )

  const hasFullTour = tours.some((tour) => tour.id === HELP_TOUR_IDS.portalFull)

  const openHelp = useCallback(() => setOpen(true), [])
  const closeHelp = useCallback(() => {
    setOpen(false)
    setActiveArticleId(null)
    setQuery('')
  }, [])
  const toggleHelp = useCallback(() => setOpen((v) => !v), [])

  const openArticle = useCallback((id) => {
    setActiveArticleId(id)
    setOpen(true)
  }, [])

  const clearArticle = useCallback(() => setActiveArticleId(null), [])

  const startFullTour = useCallback(() => {
    closeHelp()
    onStartFullTour?.()
  }, [closeHelp, onStartFullTour])

  const contactExpert = useCallback(() => {
    closeHelp()
    onContactExpert?.()
  }, [closeHelp, onContactExpert])

  const value = useMemo(() => ({
    open,
    openHelp,
    closeHelp,
    toggleHelp,
    copy,
    locale,
    role,
    contextKey,
    query,
    setQuery,
    activeTopic,
    setActiveTopic,
    topics: HELP_TOPICS,
    contextualArticles,
    searchResults,
    catalogArticles,
    activeArticle,
    activeArticleId,
    openArticle,
    clearArticle,
    hasFullTour,
    startFullTour,
    contactExpert,
  }), [
    open,
    openHelp,
    closeHelp,
    toggleHelp,
    copy,
    locale,
    role,
    contextKey,
    query,
    activeTopic,
    contextualArticles,
    searchResults,
    catalogArticles,
    activeArticle,
    activeArticleId,
    openArticle,
    clearArticle,
    hasFullTour,
    startFullTour,
    contactExpert,
  ])

  return (
    <HelpContext.Provider value={value}>
      {children}
    </HelpContext.Provider>
  )
}
