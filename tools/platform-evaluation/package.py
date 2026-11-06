"""Package the two review artifacts; never package browser data or live app files."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import shutil

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT/'dist/platform-evaluation'
MODULES = Path(__file__).resolve().parent/'node_modules'
notices = []
for package in ['astro', '@astrojs/starlight', 'tiddlywiki']:
    folder = MODULES/package
    license_path = next((folder/name for name in ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license'] if (folder/name).is_file()), None)
    if license_path:
        notices.append(package+'\n\n'+license_path.read_text(errors='replace'))
(OUT/'THIRD_PARTY_NOTICES.txt').write_text('\n\n---\n\n'.join(notices))
site = OUT/'starlight/dist'
shutil.copyfile(ROOT/'tools/serve_release.py', site/'serve.py')
shutil.copyfile(OUT/'THIRD_PARTY_NOTICES.txt', site/'THIRD_PARTY_NOTICES.txt')
(site/'READ_FIRST.txt').write_text('READING PROTOTYPE ONLY — not the replacement installed app.\nPython 3: python3 serve.py --open\nThis edition tests upstream navigation and search. Personal notes and offline installation have not been migrated.\nProduction content and private data remain unchanged.\n')
with ZipFile(OUT/'starlight-reading-prototype.zip', 'w', ZIP_DEFLATED) as archive:
    for path in sorted(site.rglob('*')):
        if path.is_file():
            archive.write(path, path.relative_to(site))
shutil.copyfile(OUT/'tiddlywiki/output/offline-survival-cache.html', OUT/'tiddlywiki-personal-library.html')
print('Packaged reading prototype ZIP and native personal-wiki HTML for review.')
