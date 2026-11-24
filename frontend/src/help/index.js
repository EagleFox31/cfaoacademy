/**
 * Module aide portail — isolé de PortalHelpMenu / portalOnboarding.
 * Branchement futur : HelpProvider + HelpCenterDrawer dans Nav ou Portal.
 */
export { HelpProvider } from './context/HelpProvider.jsx'
export { useHelp, useHelpOptional } from './context/helpContext.js'
export { resolveHelpContext, resolveSectionTourKey, HELP_SECTION_TOUR_KEYS } from './context/routes.js'
export {
  getHelpArticles,
  getHelpArticle,
  filterHelpArticles,
  getContextualHelpArticles,
  HELP_TOPICS,
} from './articles/index.js'
export { searchHelpArticles, rankHelpArticles } from './search.js'
export { HELP_TOUR_IDS, listHelpTours, getHelpTourMeta, resolveMicroTourForContext } from './tours/index.js'
export { getHelpCopy, HELP_COPY } from './i18n.js'
export { useHelpCopy } from './hooks/useHelpCopy.js'
export { default as HelpCenterPanel } from './components/HelpCenterPanel.jsx'
export { default as HelpCenterDrawer } from './components/HelpCenterDrawer.jsx'
export { default as HelpCenterPreview } from './pages/HelpCenterPreview.jsx'
export { default as PortalHelpShell } from './PortalHelpShell.jsx'
