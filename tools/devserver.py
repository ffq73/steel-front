# -*- coding: utf-8 -*-
"""零缓存 + 多线程静态服务器（ES Module 开发用）"""
import http.server, socketserver, os

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()
    def log_message(self, fmt, *args):
        pass

class ThreadingServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

with ThreadingServer(('127.0.0.1', 8899), NoCacheHandler) as httpd:
    print('no-cache threaded server on http://localhost:8899/')
    httpd.serve_forever()
