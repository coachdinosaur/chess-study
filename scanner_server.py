from __future__ import annotations
import http.server
import json
import os
import subprocess
import tempfile
import sys

PORT = 8765
HOST = '127.0.0.1'

PYTHON_EXE = os.environ.get('FEN_PYTHON_EXE', r"C:\Users\Ronaldo\fen_test\.venv\Scripts\python.exe")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WRAPPER_SCRIPT = os.path.join(BASE_DIR, 'scanner_predict.py')

class ScannerHandler(http.server.BaseHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.end_headers()

    def do_POST(self) -> None:
        if self.path != '/predict-fen':
            self.send_response(404)
            self.end_headers()
            return

        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b'{"error": "Empty body"}')
                return

            body = self.rfile.read(content_length)

            # Determine the file suffix from Content-Type, fallback to .png
            content_type = self.headers.get('Content-Type', '')
            suffix = '.png'
            if 'image/jpeg' in content_type or 'image/jpg' in content_type:
                suffix = '.jpg'
            elif 'image/png' in content_type:
                suffix = '.png'

            # Write the raw request body (binary image data) to a temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
                temp_file.write(body)
                temp_path = temp_file.name

            try:
                # Call the wrapper script with python exe
                result = subprocess.run(
                    [PYTHON_EXE, WRAPPER_SCRIPT, temp_path],
                    capture_output=True,
                    text=True,
                    check=False
                )

                if result.returncode != 0:
                    self.send_response(500)
                    self.end_headers()
                    try:
                        err_json = json.loads(result.stdout.strip())
                        self.wfile.write(json.dumps(err_json).encode('utf-8'))
                    except Exception:
                        response = {
                            "error": "Prediction wrapper failed",
                            "details": result.stderr or result.stdout
                        }
                        self.wfile.write(json.dumps(response).encode('utf-8'))
                    return

                # Read JSON from wrapper stdout
                stdout_str = result.stdout.strip()
                try:
                    res_json = json.loads(stdout_str)
                    if "error" in res_json:
                        self.send_response(500)
                    else:
                        self.send_response(200)
                        self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps(res_json).encode('utf-8'))
                except json.JSONDecodeError:
                    self.send_response(500)
                    self.end_headers()
                    response = {
                        "error": "Wrapper returned invalid JSON",
                        "stdout": stdout_str
                    }
                    self.wfile.write(json.dumps(response).encode('utf-8'))

            finally:
                if os.path.exists(temp_path):
                    try:
                        os.remove(temp_path)
                    except OSError:
                        pass

        except Exception as e:
            self.send_response(500)
            self.end_headers()
            response = {"error": str(e)}
            self.wfile.write(json.dumps(response).encode('utf-8'))

def main() -> None:
    server = http.server.ThreadingHTTPServer((HOST, PORT), ScannerHandler)
    print(f"Scanner helper server running at http://{HOST}:{PORT}/")
    print(f"Using Python: {PYTHON_EXE}")
    print(f"Using Wrapper: {WRAPPER_SCRIPT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == "__main__":
    main()
