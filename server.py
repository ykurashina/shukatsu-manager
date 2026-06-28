# server.py — 自動シャットダウン機能付き簡易Webサーバー

import http.server
import socketserver
import threading
import time
import os
import sys

PORT = 8080
last_heartbeat = time.time()
server_should_run = True
server = None

class HeartbeatHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        global last_heartbeat
        if self.path == '/heartbeat':
            last_heartbeat = time.time()
            self.send_response(200)
            self.send_header('Content-type', 'text/plain')
            self.end_headers()
            self.wfile.write(b'ok')
            return
        return super().do_GET()

    # キャッシュを無効化
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

def monitor_heartbeat():
    global server_should_run, server
    # 起動後、ブラウザが開くまでの猶予期間（15秒）
    time.sleep(15)
    while server_should_run:
        time.sleep(2)
        # 最後の通信から10秒以上空いたら自動シャットダウン
        if time.time() - last_heartbeat > 10:
            print("[INFO] ブラウザが閉じられたことを検知したため、サーバーを自動終了します。")
            server_should_run = False
            if server:
                threading.Thread(target=server.shutdown).start()
            break

def start_server():
    global server
    # 実行スクリプトのディレクトリにカレントディレクトリを移動
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    handler = HeartbeatHandler
    socketserver.TCPServer.allow_reuse_address = True
    
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        server = httpd
        print(f"[INFO] サーバーが起動しました: http://localhost:{PORT}")
        
        # 監視スレッドの開始
        monitor_thread = threading.Thread(target=monitor_heartbeat, daemon=True)
        monitor_thread.start()
        
        httpd.serve_forever()

if __name__ == '__main__':
    try:
        start_server()
    except KeyboardInterrupt:
        pass
    print("[INFO] サーバーが停止しました。")
