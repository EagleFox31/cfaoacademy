from django.apps import AppConfig


class OutboundConfig(AppConfig):
    name = "outbound"
    verbose_name = "File de sortie et emails"

    def ready(self) -> None:
        # Interdit n° 11 : un message vers l'extérieur déclaré en envoi
        # automatique fait échouer le démarrage. Le principe « rien ne sort sans
        # relecture » ne doit pas pouvoir être contourné par la configuration.
        from .catalog import assert_catalog_is_safe

        assert_catalog_is_safe()
