import { SEUIL_DEFAUT, tauxAcquisition } from '../../utils/compteRendu'

/**
 * Les fiches individuelles : une page par participant.
 *
 * Chaque fiche porte une appreciation nominative. Deux champs libres
 * l'orientent — un domaine maitrise, un domaine en retrait — et le
 * moteur s'en sert pour nuancer le texte. Ils sont facultatifs : sans
 * eux, l'appreciation s'en tient aux chiffres plutot que d'inventer.
 *
 * Le registre de chaque fiche est affiche avant generation. Un formateur
 * voit ainsi, d'un coup d'oeil, qu'une appreciation partira sur un ton
 * severe — et peut corriger la note s'il s'agit d'une erreur de saisie
 * plutot que d'un jugement.
 */
const REGISTRES = [
  { min: 90, nom: 'Éloge', tone: 'ok' },
  { min: 80, nom: 'Favorable', tone: 'ok' },
  { min: 70, nom: 'Validé', tone: 'info' },
  { min: 55, nom: 'Réservé', tone: 'warn' },
  { min: 0, nom: 'En retrait', tone: 'warn' },
]

function registre(taux) {
  if (taux == null) return { nom: 'Sans note', tone: 'muted' }
  return REGISTRES.find(r => taux >= r.min) || REGISTRES[REGISTRES.length - 1]
}

export default function CrFiches({ brouillon, maj, session }) {
  const seuil = session?.seuil ?? SEUIL_DEFAUT
  const participants = (brouillon.participants || []).filter(p => p.present !== false)

  function modifier(id, champ, valeur) {
    maj({
      participants: brouillon.participants.map(p =>
        p.id === id ? { ...p, [champ]: valeur } : p),
    })
  }

  const sansNote = participants.filter(p => tauxAcquisition(p) == null).length

  return (
    <div className="cr-panel">
      <div className="cr-panel-head">
        <h2 className="cr-panel-title">Les fiches individuelles</h2>
        <p className="cr-panel-hint">
          Une page par participant, avec une appréciation rédigée depuis ses
          notes. Précisez si vous le souhaitez un point fort et un point à
          travailler — le texte s’en servira.
        </p>
      </div>

      {sansNote > 0 && (
        <div className="cr-note cr-note--warn">
          <span className="cr-note-icon" aria-hidden="true">●</span>
          <span>
            <strong>{sansNote} participant{sansNote > 1 ? 's' : ''}</strong> sans
            note complète. Leur appréciation restera générique.
          </span>
        </div>
      )}

      <div className="cr-table-wrap">
        <table className="cr-table">
          <thead>
            <tr>
              <th>Participant</th>
              <th style={{ width: 96 }}>Acquis.</th>
              <th style={{ width: 118 }}>Ton du texte</th>
              <th>Point fort</th>
              <th>À travailler</th>
            </tr>
          </thead>
          <tbody>
            {participants.map(p => {
              const taux = tauxAcquisition(p)
              const reg = registre(taux)
              return (
                <tr key={p.id}>
                  <td>
                    <div className="cr-name">{p.prenom} {p.nom}</div>
                  </td>
                  <td>
                    <span className={`cr-calc${taux == null ? ' cr-calc--vide'
                      : taux >= seuil ? ' cr-calc--ok' : ' cr-calc--ko'}`}>
                      {taux == null ? '—' : `${taux} %`}
                    </span>
                  </td>
                  <td>
                    <span className={`cr-badge cr-badge--${reg.tone}`}>{reg.nom}</span>
                  </td>
                  <td>
                    <input className="cr-input" style={{ minWidth: 150 }}
                      value={p.domaineFort || ''}
                      placeholder="la métrologie…"
                      onChange={e => modifier(p.id, 'domaineFort', e.target.value)}
                      aria-label={`Point fort de ${p.prenom} ${p.nom}`} />
                  </td>
                  <td>
                    <input className="cr-input" style={{ minWidth: 150 }}
                      value={p.domaineFaible || ''}
                      placeholder="les travaux de mesure…"
                      onChange={e => modifier(p.id, 'domaineFaible', e.target.value)}
                      aria-label={`Point à travailler de ${p.prenom} ${p.nom}`} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: 12.5, color: 'var(--muted-2)', marginTop: 12, lineHeight: 1.5 }}>
        Écrivez les domaines avec leur article — « la métrologie », « les travaux
        de mesure ». Ils s’insèrent dans des phrases.
      </p>

      <label className="cr-part" style={{ marginTop: 20 }}>
        <input
          type="checkbox"
          checked={!!brouillon.fichesValidees}
          onChange={e => maj({ fichesValidees: e.target.checked })}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
        />
        <span className="cr-part-check" aria-hidden="true">
          {brouillon.fichesValidees ? '✓' : ''}
        </span>
        <span className="cr-part-body">
          <span className="cr-part-title">Ces appréciations me conviennent</span>
          <span className="cr-part-desc">
            Elles portent un jugement sur une personne et engagent votre
            signature. Chacune restera modifiable dans le rapport produit.
          </span>
        </span>
      </label>
    </div>
  )
}
