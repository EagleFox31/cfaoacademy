"""Le perimetre d'un compte rendu, pour les attributs de ressource Cerbos.

Le serveur n'a pas encore de source fiable pour les sessions de
formation (elles viennent du portail) : le perimetre se lit dans le
brouillon lui-meme, `scopeNode` s'il est fourni et la marque saisie.
Vide sinon. La regle de perimetre s'ajoutera aux policies quand les
sessions viendront de `cfao-operations`.
"""


def perimetre_du_contenu(contenu) -> tuple[str, str]:
    if not isinstance(contenu, dict):
        return "", ""
    scope_node = contenu.get("scopeNode")
    marque = contenu.get("marque")
    return (str(scope_node)[:64] if isinstance(scope_node, str) else "",
            str(marque)[:64] if isinstance(marque, str) else "")
