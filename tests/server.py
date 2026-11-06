from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import json
from pathlib import Path
fault={}
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*args): pass
 def do_POST(self):
  global fault
  if self.path!='/__fault':self.send_error(404);return
  fault=json.loads(self.rfile.read(int(self.headers.get('Content-Length','0'))))
  self.send_response(204);self.end_headers()
 def do_GET(self):
  if fault.get("legacy") and self.path in ("/","/index.html","/sw.js"):
   name="sw.js" if self.path=="/sw.js" else "index.html"
   self.send_response(200);self.send_header("Content-Type","application/javascript" if name=="sw.js" else "text/html");self.end_headers();self.wfile.write((Path(__file__).parent/"fixtures/v07"/name).read_bytes());return
  if self.path==fault.get('path'):
   self.send_response(fault.get('status',503));self.end_headers();self.wfile.write(b'{"articles":[]}');return
  super().do_GET()
ThreadingHTTPServer(('127.0.0.1',8000),Handler).serve_forever()
