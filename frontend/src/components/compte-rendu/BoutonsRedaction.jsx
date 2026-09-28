/**
 * Les commandes de redaction d'un champ : proposer un texte, en tirer un
 * autre, revenir au precedent.
 *
 * Le texte propose remplace le champ, qui reste librement modifiable.
 * « Annuler » rend ce qui s'y trouvait avant la derniere proposition :
 * on peut essayer une tournure sans craindre de perdre la sienne.
 */

function IconeRedaction({ autre }) {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {autre ? (
        <>
          <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" />
          <path d="M4 4v4h4" />
          <path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" />
          <path d="M20 20v-4h-4" />
        </>
      ) : (
        <>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </>
      )}
    </svg>
  )
}

export default function BoutonsRedaction({
  aTexte, enCours, desactive, raison, onRediger, peutAnnuler, onAnnuler,
}) {
  return (
    <div className="cr-redac-actions">
      {peutAnnuler && !enCours && (
        <button type="button" className="cr-redac-annuler" onClick={onAnnuler}
          title="Revenir au texte d’avant">
          Annuler
        </button>
      )}
      <button type="button" className="cr-part-ajout cr-redac"
        disabled={desactive || enCours}
        title={desactive ? raison : aTexte
          ? 'Une autre façon de le dire, à partir des mêmes chiffres'
          : 'Écrit un texte à partir des chiffres de la session'}
        onClick={onRediger}>
        <IconeRedaction autre={aTexte} />
        {enCours ? 'Écriture…' : aTexte ? 'Écrire autrement' : 'Écrire pour moi'}
      </button>
      {/* Grise, le bouton dit pourquoi, sans attendre le survol. */}
      {desactive && raison && <span className="cr-redac-raison">{raison}</span>}
    </div>
  )
}
