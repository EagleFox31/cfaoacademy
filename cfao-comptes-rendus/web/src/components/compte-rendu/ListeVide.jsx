/**
 * Etat d'une liste sans element : un seul message, le meme partout,
 * a la place de la grille ou du tableau.
 */
export default function ListeVide() {
  return (
    <div className="cr-empty" role="status">
      <div className="cr-empty-title">Aucun élément à traiter ici</div>
    </div>
  )
}
