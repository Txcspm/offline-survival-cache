"""Export existing records into upstream platforms; never change the production app.

Outputs go to ignored dist/platform-evaluation. Generated editions contain only
published repository inputs, not browser notes or private local data.
"""
import json
import importlib.util
import tempfile
import re
import subprocess
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / 'dist/platform-evaluation'


def read_library():
    # Reuse the existing editorial/schema gate without rewriting tracked catalogs.
    spec = importlib.util.spec_from_file_location('osc_validation', ROOT/'tools/build_catalog.py')
    validator = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(validator)
    with tempfile.TemporaryDirectory() as directory:
        validator.OUT = Path(directory)
        if validator.build() != 0:
            raise ValueError('Content validation failed; no prototype was exported')
    # app-data.js is trusted repository data. Node reads the existing category
    # tree and preserved originals without introducing a competing taxonomy.
    script = "const vm=require('node:vm'),fs=require('node:fs');process.stdout.write(vm.runInNewContext(fs.readFileSync(process.argv[1],'utf8')+';JSON.stringify({divisions:DIVISIONS,legacy:LEGACY_ARTICLES})'));"
    data = json.loads(subprocess.check_output(['node', '-e', script, str(ROOT/'app-data.js')], text=True))
    paths = [ROOT/'survival_cache_starter_25.json', *sorted((ROOT/'knowledge/modules').glob('*.json'))]
    articles = [a for p in paths for a in json.loads(p.read_text())['articles']]
    for original in data['legacy']:
        articles.append({**original, 'status': 'draft', 'content_stage': 'draft', 'sources': [], 'source_review': 'Preserved original reference. No independent source or editorial review.'})
    if len({a['id'] for a in articles}) != len(articles):
        raise ValueError('Duplicate IDs: refusing a lossy export')
    return articles, data['divisions']


def escape(text):
    """Keep source prose literal in Markdown instead of executing embedded HTML."""
    return re.sub(r'([\\`*_{}\[\]<>#])', r'\\\1', text)


def manuscript(article):
    status = article.get('status', 'draft')
    text = f"**{article['id']} · {article['priority']} · {status.upper()}**\n\n"
    text += ('Independent review is not recorded. This is not approved safety guidance.\n\n' if status != 'approved' else 'See the recorded review evidence and applicable local guidance.\n\n')
    text += escape(article['summary']) + '\n\n'
    for paragraph in article['body']:
        match = re.match(r'^([^:]{3,65}):\s+([\s\S]*)$', paragraph)
        text += ('## '+escape(match[1])+'\n\n'+escape(match[2]) if match else escape(paragraph))+'\n\n'
    text += '## Sources and editorial record\n\n'+escape(article.get('source_review', 'No completed review.'))+'\n\n'
    text += 'Reviewed by: '+escape(article.get('reviewed_by') or 'Not independently reviewed')+' · Review date: '+escape(article.get('reviewed_on') or 'Not recorded')+'\n\n'
    for source in article.get('sources', []):
        url = source['url'].replace(')', '%29').replace('(', '%28').replace(' ', '%20')
        text += '- ['+escape(source.get('title') or source['organization'])+']('+url+')'
        detail = ' · '.join(filter(None, [source.get('locator'), source.get('accessed_on')]))
        text += (' — '+escape(detail) if detail else '')+'\n'
    return text


def frontmatter(title, description=''):
    return '---\ntitle: '+json.dumps(title, ensure_ascii=False)+'\ndescription: '+json.dumps(description, ensure_ascii=False)+'\n---\n\n'


def export_starlight(articles, divisions):
    base = OUTPUT/'starlight'
    content = base/'src/content/docs'
    content.mkdir(parents=True, exist_ok=True)
    (base/'package.json').write_text(json.dumps({'private':True,'type':'module','dependencies':{'astro':'7.4.7','@astrojs/starlight':'0.42.9'}}))
    categories = [category for _, group in divisions for category in group]
    folders = {category: f'library/{i+1:02d}' for i, category in enumerate(categories)}
    sidebar = [{'label': 'Library home', 'link': '/'}]
    for division, group in divisions:
        children = []
        for category in group:
            folder = folders[category]
            items = [{'label': 'Overview', 'link': '/'+folder+'/'}]
            items += [{'label': a['title'], 'link': '/'+folder+'/'+a['id'].lower()+'/'} for a in articles if a['category'] == category]
            children.append({'label': category, 'collapsed': True, 'items': items})
        sidebar.append({'label': division, 'collapsed': True, 'items': children})
    options = {'title': 'Offline Survival Cache', 'sidebar': sidebar}
    (base/'astro.config.mjs').write_text("import {defineConfig} from 'astro/config';\nimport starlight from '@astrojs/starlight';\nexport default defineConfig({integrations:[starlight("+json.dumps(options, ensure_ascii=False)+")]});\n")
    (base/'src/content.config.ts').write_text("import {defineCollection} from 'astro:content';\nimport {docsLoader} from '@astrojs/starlight/loaders';\nimport {docsSchema} from '@astrojs/starlight/schema';\nexport const collections={docs:defineCollection({loader:docsLoader(),schema:docsSchema()})};\n")
    home = frontmatter('Offline Survival Cache', 'A reference library, practical field manuals, and personal knowledge.')
    home += 'Use the search box to find a topic or exact passage, or open a subject in the navigation tree. This is a framework evaluation, not the replacement deployment.\n\n'
    home += f'**{len(articles)} available references.** Status and source records are retained. None of the current articles is independently approved.\n\n'
    for division, group in divisions:
        home += '## '+division+'\n\n'+'\n'.join('- ['+escape(c)+'](/'+folders[c]+'/)' for c in group)+'\n\n'
    home += '## Personal material and offline installation\n\nThis reading prototype does not replace your notebook, saved reading, backup/restore or installed offline app. Those production features and data remain intact. Migration and offline integration are still required before this could replace the current product.\n'
    (content/'index.md').write_text(home)
    for category in categories:
        folder = content/folders[category]
        folder.mkdir(parents=True, exist_ok=True)
        selected = [a for a in articles if a['category'] == category]
        links = '\n'.join('- ['+escape(a['title'])+'](./'+a['id'].lower()+'/)' for a in selected)
        (folder/'index.md').write_text(frontmatter(category)+links+'\n')
        for a in selected:
            (folder/(a['id'].lower()+'.md')).write_text(frontmatter(a['title'], a['summary'])+manuscript(a))


def export_tiddlywiki(articles, divisions):
    base = OUTPUT/'tiddlywiki'
    (base/'tiddlers').mkdir(parents=True, exist_ok=True)
    info = {'description': 'Offline Survival Cache platform evaluation', 'plugins': ['tiddlywiki/browser-storage', 'tiddlywiki/comments', 'tiddlywiki/markdown'], 'themes': ['tiddlywiki/vanilla', 'tiddlywiki/snowwhite'], 'build': {'index': ['--render', '$:/core/save/all', 'offline-survival-cache.html', 'text/plain']}}
    (base/'tiddlywiki.info').write_text(json.dumps(info, indent=2))
    tiddlers = []
    def add(title, text='', **fields):
        tiddlers.append({'title': title, 'text': text, **fields})
    def tag(name):
        return '[['+name+']]'
    add('$:/SiteTitle', 'Offline Survival Cache')
    add('$:/SiteSubtitle', 'Reference library · Field manuals · Personal knowledge')
    add('$:/DefaultTiddlers', '[[Start here]]')
    add('$:/config/DefaultSidebarTab', '$:/osc/Contents')
    add('$:/config/BrowserStorage/Enabled', 'yes')
    add('$:/config/BrowserStorage/SaveFilter', '[all[]] -[prefix[$:/state/popup/]] -[prefix[$:/temp/]] -[prefix[$:/HistoryList]]')
    add('$:/osc/Contents', '<<toc-selective-expandable "Browse subjects">>', caption='Contents', tags='$:/tags/SideBar')
    add('Start here', "A personal wiki using TiddlyWiki’s existing search, editing, comments, import/export and save system.\n\n!! Find information\n* [[Browse subjects]]\n* [[Field manuals]]\n* [[My library]]\n\nUse the sidebar search for topics or article IDs. Native comments provide personal annotations.\n\n!! Collection\n"+str(len(articles))+" available references. Current records are drafts, not independently approved guidance.\n\n!! Preserve your work\nUse the native save changes button to download an HTML copy containing your edits. Browser storage is only an additional convenience. This evaluation does not import or replace production notes automatically.")
    add('Browse subjects', '<<list-links "[tag[Division]sort[title]]">>', tags='Navigation')
    for division, categories in divisions:
        add(division, '<<list-links "[tag['+division+']sort[title]]">>', tags=tag('Division')+' '+tag('Browse subjects'))
        for category in categories:
            add(category, '<<list-links "[tag['+category+']sort[caption]]">>', tags=tag(division))
    add('Field manuals', '<<list-links "[tag[Field manual]sort[caption]]">>', tags='Navigation')
    add('My library', '!! Personal material\nCreate native tiddlers and tag them "Personal".\n\n<<list-links "[tag[Personal]sort[title]]">>', tags='Navigation')
    add('Field notebook', 'This is a separate prototype notebook. Your production notes remain unchanged.', tags='Personal', type='text/plain')
    for a in articles:
        add(a['title']+' ('+a['id']+')', manuscript(a), caption=a['title'], type='text/markdown', tags=tag(a['category'])+(' '+tag('Field manual') if a['id'].startswith('OSC-10') else ''), **{'osc-id': a['id'], 'osc-status': a.get('status', 'draft'), 'osc-stage': a.get('content_stage', 'draft'), 'osc-record': json.dumps(a, ensure_ascii=False)})
    (base/'tiddlers/library.json').write_text(json.dumps(tiddlers, ensure_ascii=False, indent=2)+'\n')


def main():
    articles, divisions = read_library()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    export_starlight(articles, divisions)
    export_tiddlywiki(articles, divisions)
    (OUTPUT/'manifest.json').write_text(json.dumps({'article_count': len(articles), 'ids': [a['id'] for a in articles], 'status_counts': dict(Counter(a.get('status', 'draft') for a in articles)), 'note': 'Evaluation exports only. Production application and personal data remain unchanged.'}, indent=2)+'\n')
    print(f'Exported {len(articles)} records into upstream Starlight and TiddlyWiki editions.')


if __name__ == '__main__':
    main()
