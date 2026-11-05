from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import json
fault={}
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*args): pass
 def do_POST(self):
  global fault
  if self.path!='/__fault':self.send_error(404);return
  fault=json.loads(self.rfile.read(int(self.headers.get('Content-Length','0'))))
  self.send_response(204);self.end_headers()
 def do_GET(self):
  if self.path==fault.get('path'):
   self.send_response(fault.get('status',503));self.end_headers();self.wfile.write(b'{"articles":[]}');return
  super().do_GET()
ThreadingHTTPServer(('127.0.0.1',8000),Handler).serve_forever()
