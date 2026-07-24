#!/usr/bin/env python3
import http.server
import socketserver
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
os.chdir(os.path.dirname(os.path.abspath(__file__)))

PORT = 8000

socketserver.TCPServer.allow_reuse_address = True
Handler = http.server.SimpleHTTPRequestHandler

with socketserver.ThreadingTCPServer(("127.0.0.1", PORT), Handler) as httpd:
    print(f"🚀 Servidor rodando em: http://localhost:{PORT}")
    print(f"   Abre no navegador: http://localhost:{PORT}/index.html")
    print(f"   (Ctrl+C para parar)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n⏹️  Servidor parado")
