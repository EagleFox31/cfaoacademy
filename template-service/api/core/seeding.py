"""Seeds de referentiel en creer-seulement (AGENTS.md section 7).

Toujours `ensure`, jamais `update_or_create` : une ligne absente est ajoutee,
une ligne presente n'est jamais reecrite, meme si elle a ete modifiee en prod.
"""


def ensure(model, lookup, defaults=None):
    """Cree la ligne `lookup` si elle manque. Renvoie (objet, cree)."""
    return model.objects.get_or_create(defaults=defaults or {}, **lookup)
