from django.apps import AppConfig


class OutboundConfig(AppConfig):
    name = "outbound"
    verbose_name = "File de sortie et emails"

    def ready(self) -> None:
        from .catalog import assert_catalog_is_safe

        assert_catalog_is_safe()
