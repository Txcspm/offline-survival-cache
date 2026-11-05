#!/usr/bin/env python3
"""Offline Survival Cache catalog builder. Standard library only."""
import hashlib
import json
import re
import sys
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
MODULES = [ROOT / 'survival_cache_starter_25.json']
MODULES += sorted((ROOT / 'knowledge' / 'modules').glob('*.json'))
OUT = ROOT / 'knowledge'
CATEGORIES = {
 'Emergency Survival & Decision Making','Medical Care & First Aid','Shelter & Environmental Protection','Water Collection & Treatment',
 'Food & Nutrition','Agriculture & Gardening','Animal Husbandry & Fisheries','Wilderness Skills & Natural Resources',
 'Power Generation & Electricity','Construction & Structural Repair','Mechanical Systems & Fabrication','Water, Waste & Public Sanitation','Fire, Heating & Cooking Systems',
 'Radio & Emergency Communications','Computing & Offline Information Systems','Mathematics, Science & Measurement','Knowledge Preservation & Education',
 'Navigation & Cartography','Transportation & Vehicle Maintenance','Security & Personal Safety',
 'Natural Disasters & Environmental Hazards','Emergency Management & Community Response','Family & Household Continuity','Psychological Resilience & Group Dynamics',
 'Community Organization & Governance','Trade, Logistics & Resource Management','Environmental Stewardship & Resource Renewal',
 'Survival Reference Encyclopedia','Field Tools, Calculators & Forms','Practical Skills & Training Curriculum'
}

def fail(msg):
    raise ValueError(msg)

def strict_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result: fail(f'duplicate JSON property {key}')
        result[key] = value
    return result

def build():
    seen = set()
    module_ids = set()
    titles = {}
    duplicate_titles = []
    bodies = set()
    hashes = {}
    entries = []
    errors = []
    for path in MODULES:
        if not path.is_file():
            continue
        try:
            module = json.loads(path.read_text(encoding='utf-8'), object_pairs_hook=strict_object, parse_constant=lambda value: fail('nonfinite JSON number'))
            if not isinstance(module, dict) or not isinstance(module.get('articles'), list):
                fail('expected object with articles array')
            if set(module) - {'schema_version','module_id','module_title','review_status','articles'}: fail('unknown module fields')
            if module.get('schema_version') != '1.0': fail('unsupported schema_version')
            if not isinstance(module.get('module_title'), str) or not module['module_title'].strip(): fail('missing module_title')
            if module.get('review_status') not in ('draft','in_review','approved','retired'): fail('invalid module review_status')
            module_id = module.get('module_id')
            if not isinstance(module_id, str) or not module_id.strip():
                fail('missing module_id')
            if module_id in module_ids: fail('duplicate module_id')
            module_ids.add(module_id)
            hashes[path.relative_to(ROOT).as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
            for idx, article in enumerate(module['articles'], 1):
                where = f'{path.relative_to(ROOT)} article {idx}'
                try:
                    if not isinstance(article, dict): fail('article must be an object')
                    allowed = {'id','title','summary','category','priority','status','body','sources','source_review','reviewed_by','reviewed_on','content_stage'}
                    if set(article) - allowed: fail('unknown article fields')
                    if not allowed.difference({'reviewed_by','reviewed_on','content_stage'}).issubset(article): fail('missing required article fields')
                    if article.get('content_stage', 'draft') not in ('outline','draft','complete'): fail('invalid content_stage')
                    ident = article.get('id')
                    if not isinstance(ident, str) or not re.fullmatch(r'OSC-\d{4,6}', ident): fail('invalid article id')
                    if ident in ('OSC-0001','OSC-0002','OSC-0003'): fail('ID reserved for embedded unverified legacy reference')
                    if ident in seen: fail(f'duplicate article id {ident}')
                    seen.add(ident)
                    for field in ('title','summary','category'):
                        if not isinstance(article.get(field), str) or not article[field].strip(): fail(f'missing {field}')
                    if article['category'] not in CATEGORIES: fail('unknown category')
                    if article.get('priority') not in ('P0','P1','P2','P3'): fail('invalid priority')
                    status = article.get('status', 'draft')
                    if status not in ('draft','in_review','approved','retired'): fail('invalid status')
                    body = article.get('body')
                    if not isinstance(body, list) or not body or any(not isinstance(x, str) or not x.strip() for x in body):
                        fail('body must be a nonempty array of text steps')
                    title_key = re.sub(r'\W+', ' ', article['title'].casefold()).strip()
                    body_key = re.sub(r'\W+', ' ', ' '.join(body).casefold()).strip()
                    if title_key in titles:
                        pair = frozenset((titles[title_key], ident))
                        if pair not in {frozenset(('OSC-0011','OSC-0035')),frozenset(('OSC-0034','OSC-0045'))}: fail('duplicate normalized title')
                        duplicate_titles.append(sorted(pair))
                        print(f'WARNING: {ident}: existing duplicate title; editorial reconciliation required', file=sys.stderr)
                    if body_key in bodies: fail('duplicate normalized body')
                    titles[title_key] = ident
                    bodies.add(body_key)
                    sources = article.get('sources', [])
                    if not isinstance(sources, list): fail('sources must be an array')
                    for source in sources:
                        if isinstance(source, dict) and set(source) - {'organization','url','title','accessed_on','locator'}: fail('unknown source fields')
                        if not isinstance(source, dict) or not isinstance(source.get('organization'), str) or not isinstance(source.get('url'), str) or not source['url'].startswith('https://'):
                            fail('source requires organization and https URL')
                    if not isinstance(article.get('source_review'),str) or not article['source_review'].strip(): fail('missing source_review')
                    for source in sources:
                        parsed = urlparse(source['url'])
                        if not parsed.hostname or parsed.username or parsed.password or not source['organization'].strip(): fail('invalid source record')
                    if status == 'approved':
                        if article.get('content_stage') != 'complete': fail('approved article must be complete')
                        if not sources: fail('approved article requires sources')
                        if not isinstance(article.get('reviewed_by'), str) or not article['reviewed_by'].strip(): fail('approved article requires reviewed_by')
                        reviewed_on = article.get('reviewed_on')
                        if not isinstance(reviewed_on,str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}',reviewed_on): fail('invalid review date format')
                        try: date.fromisoformat(reviewed_on)
                        except (TypeError, ValueError): fail('approved article requires valid reviewed_on YYYY-MM-DD')
                        if date.fromisoformat(reviewed_on) > date.today(): fail('review date is in the future')
                        for source in sources:
                            if not source.get('title') or not source.get('locator') or not source.get('accessed_on'): fail('approved sources require title, locator and accessed_on')
                            if not isinstance(source['accessed_on'],str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}',source['accessed_on']): fail('invalid source access date format')
                            try: accessed = date.fromisoformat(source['accessed_on'])
                            except (TypeError, ValueError): fail('invalid source access date')
                            if accessed > date.today(): fail('source access date is in the future')
                        if not article.get('source_review') or 'pending' in str(article['source_review']).lower():
                            fail('approved article requires completed source_review')
                    entries.append({
                        'id':ident,'title':article['title'],'category':article['category'],
                        'priority':article['priority'],'content_stage':article.get('content_stage','draft'),'status':status,'summary':article['summary'],
                        'module_id':module_id,'module_path':path.relative_to(ROOT).as_posix(),
                        'reviewed_on':article.get('reviewed_on'),
                        'search_text':' '.join([article['title'],article['summary'],article['category'],*body]).lower()
                    })
                except ValueError as ex:
                    errors.append(f'{where}: {ex}')
        except (ValueError, json.JSONDecodeError) as ex:
            errors.append(f'{path.relative_to(ROOT)}: {ex}')
    if errors:
        print('\n'.join('ERROR: '+x for x in errors), file=sys.stderr)
        return 1
    entries.sort(key=lambda x:x['id'])
    OUT.mkdir(exist_ok=True)
    public = [{k:v for k,v in e.items() if k!='search_text'} for e in entries]
    catalog = {'schema_version':'1.0','modules':hashes,'editorial':{'duplicate_title_pairs':duplicate_titles,'target_articles':3650,'target_categories':30},'total':len(public),'counts':{s:sum(e['status']==s for e in public) for s in ('draft','in_review','approved','retired')},'articles':public}
    search = {'schema_version':'1.0','articles':[{'id':e['id'],'text':e['search_text']} for e in entries if e['status']!='retired']}
    (OUT/'catalog.json').write_text(json.dumps(catalog,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    (OUT/'search-index.json').write_text(json.dumps(search,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    print(f'Validated {len(public)} articles from {len([p for p in MODULES if p.is_file()])} modules; approved: {catalog["counts"]["approved"]}')
    return 0

if __name__ == '__main__':
    sys.exit(build())
