"""Routeur DRF qui accepte `/resource` et `/resource/`.

Sans ça : un navigateur qui a mis en cache une redirection 301 vers le slash
(ancienne config `trailing_slash=True`) continue d'appeler `/campaigns/` et
reçoit 404 après le passage à `trailing_slash=False`. Les PATCH sans slash
restent valides.
"""
from rest_framework.routers import SimpleRouter


class OptionalSlashRouter(SimpleRouter):
    def __init__(self, *args, **kwargs):
        kwargs["trailing_slash"] = True
        super().__init__(*args, **kwargs)
        # SimpleRouter n'accepte que True/False ; on force un quantificateur
        # optionnel dans les regex générées (`^campaigns/?$`, `.../lines/?$`).
        self.trailing_slash = "/?"
