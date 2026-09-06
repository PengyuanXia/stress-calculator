"""
StructLab.tech Beam Stress Distribution Calculator Server
Hosts the stress calculator app locally and opens the browser.
"""

import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 3004

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

def run_server():
    web_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(web_dir)
    
    global PORT
    for p in range(3004, 3020):
        try:
            httpd = socketserver.ThreadingTCPServer(("", p), Handler)
            PORT = p
            break
        except OSError:
            continue
    else:
        print("Error: Could not bind to any port in 3004-3020.")
        sys.exit(1)
        
    url = f"http://localhost:{PORT}"
    print("=" * 60)
    print("  StructLab.tech — Beam Stress Distribution Calculator")
    print(f"  Running locally at: {url}")
    print("=" * 60)
    
    try:
        webbrowser.open(url)
    except Exception as e:
        print(f"Note: Could not automatically open browser: {e}")
        
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        httpd.server_close()

if __name__ == "__main__":
    run_server()
