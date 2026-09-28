"""Les modules des services s'importent comme au demarrage de `api.py`."""
import sys
from pathlib import Path

SERVICES = Path(__file__).resolve().parents[1]
for dossier in ('apercu', 'redaction'):
    sys.path.insert(0, str(SERVICES / dossier))
