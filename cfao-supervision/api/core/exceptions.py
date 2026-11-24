"""Erreurs normalisées : { "error": { "code", "message", "details" } } (architecture.md §5.1)."""
from rest_framework.views import exception_handler


def normalized_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return None
    detail = response.data
    code = getattr(exc, "default_code", "error")
    message = detail.get("detail") if isinstance(detail, dict) else detail
    response.data = {
        "error": {
            "code": code,
            "message": str(message) if message else "error",
            "details": detail if not isinstance(message, str) else {},
        }
    }
    return response
