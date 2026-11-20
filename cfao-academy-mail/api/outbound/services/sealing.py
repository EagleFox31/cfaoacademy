"""Chiffrement des champs secrets d'un message sensible (Fernet).

La clé vient de `MAIL_SEALED_CONTEXT_KEY`. Sans clé, aucun message sensible
n'est accepté (default-deny). Perdre la clé rend illisibles les messages encore
en file : ils expirent, le producteur en redemande un.
"""
from __future__ import annotations

import json

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings


class SealingUnavailable(Exception):
    pass


def _fernet() -> Fernet:
    key = (getattr(settings, "MAIL_SEALED_CONTEXT_KEY", "") or "").strip()
    if not key:
        raise SealingUnavailable("MAIL_SEALED_CONTEXT_KEY n'est pas configurée.")
    try:
        return Fernet(key.encode())
    except (ValueError, TypeError) as exc:
        raise SealingUnavailable("MAIL_SEALED_CONTEXT_KEY invalide (clé Fernet attendue).") from exc


def seal(values: dict) -> bytes:
    return _fernet().encrypt(json.dumps(values, ensure_ascii=False).encode("utf-8"))


def unseal(token: bytes | memoryview | None) -> dict:
    if not token:
        raise SealingUnavailable("Contexte scellé absent.")
    try:
        return json.loads(_fernet().decrypt(bytes(token)).decode("utf-8"))
    except InvalidToken as exc:
        raise SealingUnavailable("Contexte scellé illisible avec la clé actuelle.") from exc
