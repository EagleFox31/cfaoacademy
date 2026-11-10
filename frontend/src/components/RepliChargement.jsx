import { Component } from 'react'
import useLocale from '../hooks/useLocale.js'

function MessageRepli() {
  const { t } = useLocale('common')
  return (
    <div role="alert" style={{ minHeight: '60vh', display: 'grid', placeContent: 'center', justifyItems: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
      <p>{t.pageLoadError}</p>
      <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
        {t.pageLoadRetry}
      </button>
    </div>
  )
}

/** Une page qui ne se charge pas laisse un message et un bouton, pas un écran blanc. */
export default class RepliChargement extends Component {
  state = { erreur: false }

  static getDerivedStateFromError() {
    return { erreur: true }
  }

  render() {
    return this.state.erreur ? <MessageRepli /> : this.props.children
  }
}
