import { useHelp } from '../context/helpContext.js'
import HelpCenterPanel from './HelpCenterPanel.jsx'

/** Overlay + panneau latéral — prêt à brancher sur le bouton Aide. */
export default function HelpCenterDrawer() {
  const { open, closeHelp } = useHelp()

  if (!open) return null

  return (
    <div className="help-center-overlay" role="presentation">
      <button
        type="button"
        className="help-center-overlay-backdrop"
        aria-label="Close"
        onClick={closeHelp}
      />
      <HelpCenterPanel mode="drawer" onClose={closeHelp} />
    </div>
  )
}
