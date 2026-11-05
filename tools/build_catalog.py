#!/usr/bin/env python3
"""Offline Survival Cache catalog builder. Standard library only."""
import json
import re
import sys
from datetime import date
from pathlib import Path

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

def build():
    seen = set()
    entries = []
    errors = []
    for path in MODULES:
        if not path.is_file():
            continue
        try:
            module = json.loads(path.read_text(encoding='utf-8'))
            if not isinstance(module, dict) or not isinstance(module.get('articles'), list):
                fail('expected object with articles array')
            module_id = module.get('module_id')
            if not isinstance(module_id, str) or not module_id.strip():
                fail('missing module_id')
            for idx, article in enumerate(module['articles'], 1):
                where = f'{path.relative_to(ROOT)} article {idx}'
                try:
                    if not isinstance(article, dict): fail('article must be an object')
                    ident = article.get('id')
                    if not isinstance(ident, str) or not re.fullmatch(r'OSC-\d{4,6}', ident): fail('invalid article id')
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
                    sources = article.get('sources', [])
                    if not isinstance(sources, list): fail('sources must be an array')
                    for source in sources:
                        if not isinstance(source, dict) or not isinstance(source.get('organization'), str) or not isinstance(source.get('url'), str) or not source['url'].startswith('https://'):
                            fail('source requires organization and https URL')
                    if status == 'approved':
                        if not sources: fail('approved article requires sources')
                        if not article.get('reviewed_by'): fail('approved article requires reviewed_by')
                        reviewed_on = article.get('reviewed_on')
                        try: date.fromisoformat(reviewed_on)
                        except (TypeError, ValueError): fail('approved article requires valid reviewed_on YYYY-MM-DD')
                        if not article.get('source_review') or 'pending' in str(article['source_review']).lower():
                            fail('approved article requires completed source_review')
                    entries.append({
                        'id':ident,'title':article['title'],'category':article['category'],
                        'priority':article['priority'],'status':status,'summary':article['summary'],
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
    catalog = {'schema_version':'1.0','total':len(public),'counts':{s:sum(e['status']==s for e in public) for s in ('draft','in_review','approved','retired')},'articles':public}
    search = {'schema_version':'1.0','articles':[{'id':e['id'],'text':e['search_text']} for e in entries if e['status']!='retired']}
    (OUT/'catalog.json').write_text(json.dumps(catalog,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    (OUT/'search-index.json').write_text(json.dumps(search,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    print(f'Validated {len(public)} articles from {len([p for p in MODULES if p.is_file()])} modules; approved: {catalog["counts"]["approved"]}')
    return 0

if __name__ == '__main__':
    sys.exit(build())
