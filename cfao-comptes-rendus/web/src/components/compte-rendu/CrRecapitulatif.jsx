import { useState } from 'react'
import { periodeLongue, SEUIL_DEFAUT } from '../../utils/compteRendu'

/**
 * Derniere etape : verifier, puis produire.
 *
 * Le recapitulatif montre ce qui part et ce qui manque, sans rien
 * interdire : un rapport peut se generer avec des notes incompletes, le
 * formateur assume. Ce qui serait fautif, c'est de le laisser generer
 * sans lui dire ce qui manque.
 *
 * La generation produit ici le dossier de session au format attendu par
 * `remplir.py`. Le fichier PowerPoint sera assemble par le service de
 * generation, une fois celui-ci branche ; en attendant, le dossier se
 * telecharge et se passe au script.
 */
export default function CrRecapitulatif({
  brouillon, session, synthese, parties, dossier, onRecommencer,
}) {
  const [etat, setEtat] = useState('pret')
  const seuil = session?.seuil ?? SEUIL_DEFAUT
  const retenues = parties.filter(p => (brouillon.parties || []).includes(p.id))

  const manques = []
  if (!synthese.complet) {
    manques.push(`${synthese.effectif - synthese.notesSaisies} participant(s) sans note complète`)
  }
  if ((brouillon.parties || []).includes('deroule')) {
    const jours = Object.values(brouillon.jours || {})
      .filter(j => (j.thematiques || []).some(t => t && t.trim())).length
    const attendus = session?.nbJours || 0
    if (jours < attendus) manques.push(`${attendus - jours} journée(s) non renseignée(s)`)
  }
  const photos = Object.values(brouillon.photos || {}).reduce((a, l) => a + (l?.length || 0), 0)
  if (photos === 0) manques.push('aucune photo')
  if (!brouillon.bilanValide && (brouillon.parties || []).includes('bilan')) {
    manques.push('bilan non relu')
  }

  function produire() {
    setEtat('encours')
    const data = dossier()
    // La generation du `.pptx` revient au service Python. Ici on remet
    // au formateur le dossier complet, dans la forme que le moteur
    // attend, pour qu'il puisse lancer la production.
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `session-${session?.codeSession?.replace(/\W+/g, '-').toLowerCase() || 'rapport'}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setTimeout(() => setEtat('fait'), 400)
  }

  if (etat === 'fait') {
    return (
      <div className="cr-panel">
        <div className="cr-empty">
          <div style={{ fontSize: 40, color: '#147a41' }} aria-hidden="true">✓</div>
          <div className="cr-empty-title">Dossier de session produit</div>
          <p className="cr-empty-text">
            Le fichier est dans vos téléchargements. Le rapport PowerPoint sera
            assemblé à partir de ce dossier.
          </p>
        </div>
        <div className="cr-actions" style={{ justifyContent: 'center' }}>
          <button type="button" className="cr-btn cr-btn--ghost" onClick={onRecommencer}>
            Rédiger un autre compte rendu
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="cr-panel">
      <div className="cr-panel-head">
        <h2 className="cr-panel-title">Tout est prêt ?</h2>
        <p className="cr-panel-hint">
          Voici ce que contiendra le rapport. Vous pouvez revenir sur n’importe
          quelle étape en cliquant dessus dans le fil, en haut.
        </p>
      </div>

      <div className="cr-kpis">
        <div className="cr-kpi">
          <div className="cr-kpi-val">{synthese.effectif}</div>
          <div className="cr-kpi-lab">Participants</div>
        </div>
        <div className="cr-kpi">
          <div className="cr-kpi-val">{synthese.moyenneAcquisition ?? '—'}<span style={{ fontSize: 16 }}> %</span></div>
          <div className="cr-kpi-lab">Acquisition moyenne</div>
        </div>
        <div className="cr-kpi">
          <div className={`cr-kpi-val${synthese.enRetrait === 0 ? ' cr-kpi-val--ok' : ' cr-kpi-val--ko'}`}>
            {synthese.enRetrait}
          </div>
          <div className="cr-kpi-lab">Sous le seuil de {seuil} %</div>
        </div>
        <div className="cr-kpi">
          <div className="cr-kpi-val">{photos}</div>
          <div className="cr-kpi-lab">Photos</div>
        </div>
      </div>

      {manques.length > 0 && (
        <div className="cr-note cr-note--warn">
          <span className="cr-note-icon" aria-hidden="true">●</span>
          <span>
            <strong>Le rapport sera incomplet :</strong> {manques.join(', ')}.
            Vous pouvez générer quand même — les éléments manquants resteront
            en attente dans le document.
          </span>
        </div>
      )}

      <div className="cr-field-label" style={{ marginBottom: 10 }}>
        Contenu du rapport
      </div>
      <div className="cr-parts" style={{ marginBottom: 6 }}>
        {retenues.map(p => (
          <div key={p.id} className="cr-part cr-part--on" style={{ cursor: 'default' }}>
            <span className="cr-part-check" aria-hidden="true">✓</span>
            <span className="cr-part-body">
              <span className="cr-part-title">{p.titre}</span>
              <span className="cr-part-desc">{p.resume}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="cr-note cr-note--info" style={{ marginTop: 18 }}>
        <span className="cr-note-icon" aria-hidden="true">●</span>
        <span>
          Les textes produits sont des <strong>propositions</strong>. Ils
          portent un jugement sur des personnes et restent modifiables dans le
          document final — relisez-les avant diffusion.
        </span>
      </div>

      <div className="cr-actions">
        <div className="cr-actions-info">
          {session?.moduleFormation} — {periodeLongue(session?.debut, session?.fin)}
        </div>
        <div className="cr-actions-right">
          <button type="button" className="cr-btn cr-btn--primary"
            onClick={produire} disabled={etat === 'encours'}>
            {etat === 'encours' ? 'Production…' : 'Produire le rapport'}
          </button>
        </div>
      </div>
    </div>
  )
}
