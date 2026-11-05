"""Produce identical Pages and downloadable bundles without development files."""
import json
import shutil
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from hashlib import sha256
ROOT = Path(__file__).resolve().parents[1]
def package():
    site = ROOT / '_site'
    site.mkdir(exist_ok=True)
    catalog = json.loads((ROOT/'knowledge/catalog.json').read_text())
    files = ['index.html','sw.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','knowledge/catalog.json','knowledge/search-index.json',*catalog['modules']]
    for name in set(files):
        target=site/name
        target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(ROOT/name,target)
    (site/'.nojekyll').touch()
    (site/'START_HERE.txt').write_text('Serve this folder with Python 3: python3 -m http.server 8000\nOpen http://localhost:8000 and wait for offline installation.\nKeep the same browser profile and origin to preserve notes. Export notes before moving.\nOpening index.html with file:// does not support service workers.\nAll current content is unverified.\n')
    dist=ROOT/'dist';dist.mkdir(exist_ok=True)
    archive=dist/'offline-survival-cache.zip'
    with ZipFile(archive,'w',ZIP_DEFLATED) as z:
        for name in sorted(set(files)|{'.nojekyll','START_HERE.txt'}): z.write(site/name,name)
    (dist/'SHA256SUMS').write_text(sha256(archive.read_bytes()).hexdigest()+'  '+archive.name+'\n')
if __name__=='__main__': package()
