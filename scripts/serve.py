#!/usr/bin/env python3
"""Local preview server for the site.

Serves ./public and applies vercel.json's headers, cleanUrls and 404 page, so what you see locally
behaves like production (including the Content-Security-Policy). No dependencies.

    python3 scripts/serve.py [port]        # default 4173  ->  http://localhost:4173
"""
import http.server
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PUBLIC = os.path.join(ROOT, "public")

with open(os.path.join(ROOT, "vercel.json"), encoding="utf-8") as f:
    CONFIG = json.load(f)

RULES = [(re.compile(rule["source"]), rule["headers"]) for rule in CONFIG.get("headers", [])]
CLEAN_URLS = CONFIG.get("cleanUrls", False)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC, **kwargs)

    def translate_path(self, path):
        resolved = super().translate_path(path)
        if CLEAN_URLS and not os.path.exists(resolved) and os.path.exists(resolved + ".html"):
            return resolved + ".html"
        return resolved

    def send_error(self, code, message=None, explain=None):
        page = os.path.join(PUBLIC, "404.html")
        if code == 404 and os.path.exists(page):
            with open(page, "rb") as f:
                body = f.read()
            self.send_response(404)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)
            return
        super().send_error(code, message, explain)

    def end_headers(self):
        path = self.path.split("?", 1)[0]
        for pattern, headers in RULES:
            if pattern.fullmatch(path):
                for header in headers:
                    self.send_header(header["key"], header["value"])
        if not path.startswith("/fonts/"):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4173
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler) as server:
        print(f"Serving {PUBLIC} at http://localhost:{port}", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
