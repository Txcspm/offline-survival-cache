#!/usr/bin/env python3
"""Serve the extracted library on a stable loopback origin; no third-party packages."""
import argparse
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import webbrowser


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--open', action='store_true', help='Open the library in your default browser')
    args = parser.parse_args()
    folder = Path(__file__).resolve().parent
    handler = functools.partial(SimpleHTTPRequestHandler, directory=str(folder))
    try:
        server = ThreadingHTTPServer(('127.0.0.1', args.port), handler)
    except OSError as error:
        parser.exit(1, f'Cannot start local server: {error}\nUse the existing library server or choose --port explicitly. Changing ports uses different browser storage.\n')
    address = f'http://localhost:{args.port}/'
    print(f'Survival Cache: {address}\nKeep this window open while serving the library. Press Ctrl+C to stop.\nUse this same address and browser profile to keep access to your notes.', flush=True)
    if args.open:
        webbrowser.open(address)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
