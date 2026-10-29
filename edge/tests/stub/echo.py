"""Module factice : renvoie en JSON ce que la passerelle lui transmet.

Variables : NOM (needs, cr), PORT. Sert au smoke de cfao-edge, rien d'autre.
"""
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

NOM = os.environ.get("NOM", "stub")
PORT = int(os.environ.get("PORT", "8000"))


class Echo(BaseHTTPRequestHandler):
    def _repondre(self):
        taille = int(self.headers.get("Content-Length") or 0)
        while taille > 0:  # le corps est lu en entier (test des limites de taille)
            taille -= len(self.rfile.read(min(taille, 65536)))
        if self.path.startswith("/redir"):
            self.send_response(302)
            self.send_header("Location", "/ailleurs")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        corps = json.dumps({"module": NOM, "methode": self.command, "chemin": self.path,
                            "en_tetes": {k.lower(): v for k, v in self.headers.items()}}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(corps)))
        self.send_header("Set-Cookie", "t1=1; Path=/")
        self.send_header("Set-Cookie", "t2=1; Path=/cr/x")
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        self.send_header("X-Powered-By", "stub")
        self.end_headers()
        self.wfile.write(corps)

    do_GET = do_POST = do_PUT = do_DELETE = _repondre

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", PORT), Echo).serve_forever()
