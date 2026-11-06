"""Produce identical Pages and downloadable bundles without development files."""
import json
import shutil
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from hashlib import sha256
ROOT = Path(__file__).resolve().parents[1]
def package():
    site = ROOT / '_site'
    # Build from an explicit manifest; remove stale generated deployment files.
    if site.exists(): shutil.rmtree(site)
    site.mkdir(exist_ok=True)
    catalog = json.loads((ROOT/'knowledge/catalog.json').read_text())
    files = ['index.html','app.css','app.js','app-data.js','sw.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','knowledge/catalog.json','knowledge/search-index.json',*catalog['modules']]
    for name in set(files):
        target=site/name
        target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(ROOT/name,target)
    shutil.copyfile(ROOT/'tools/serve_release.py',site/'serve.py')
    (site/'Start Library.bat').write_text('@echo off\r\ncd /d "%~dp0"\r\npy -3 serve.py --open\r\nif errorlevel 1 pause\r\n')
    (site/'Start Library.command').write_text('#!/bin/sh\ncd -- "$(dirname -- "$0")" || exit 1\nexec python3 serve.py --open\n')
    (site/'Start Library.command').chmod(0o755)
    (site/'.nojekyll').touch()
    (site/'START_HERE.txt').write_text('Requires Python 3. Windows: double-click Start Library.bat. macOS: run Start Library.command (you may need to allow execution). Other systems: python3 serve.py --open\nOpen http://localhost:8000 and wait for offline installation.\nKeep the same browser profile and origin to preserve notes. Export notes before moving.\nOpening index.html with file:// does not support service workers.\nAll current content is unverified.\n')
    dist=ROOT/'dist';dist.mkdir(exist_ok=True)
    archive=dist/'offline-survival-cache.zip'
    with ZipFile(archive,'w',ZIP_DEFLATED) as z:
        for name in sorted(set(files)|{'.nojekyll','START_HERE.txt','serve.py','Start Library.bat','Start Library.command'}): z.write(site/name,name)
    (site/'downloads').mkdir(exist_ok=True)
    shutil.copyfile(archive,site/'downloads'/archive.name)
    development=ROOT/'downloads';development.mkdir(exist_ok=True)
    shutil.copyfile(archive,development/archive.name)
    (dist/'SHA256SUMS').write_text(sha256(archive.read_bytes()).hexdigest()+'  '+archive.name+'\n')
    shutil.copyfile(dist/'SHA256SUMS',site/'downloads/SHA256SUMS')
    shutil.copyfile(dist/'SHA256SUMS',development/'SHA256SUMS')
if __name__=='__main__': package()
