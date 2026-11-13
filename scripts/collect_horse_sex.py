#!/usr/bin/env python3
"""Freeze Wikidata P21 sex claims for horse cards.

Only explicit P21=male/female are retained. Unsupported/ambiguous values stay
unknown. Source file records the retrieval time and the exact QID map.
"""
import argparse
import datetime
import json
import pathlib
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT=pathlib.Path(__file__).resolve().parents[1]
API='https://www.wikidata.org/w/api.php'
VALUES={'Q6581097':'male','Q6581072':'female'}

def request_claims(ids):
    params=urllib.parse.urlencode({'action':'wbgetentities','ids':'|'.join(ids),'props':'claims','format':'json'})
    url=API+'?'+params
    for attempt in range(5):
        try:
            req=urllib.request.Request(url,headers={
                'User-Agent':'FamilyTreeGame/0.1 (+https://github.com/hanagemaru/-family-tree-game; non-commercial data audit)',
                'Accept':'application/json',
            })
            with urllib.request.urlopen(req,timeout=60) as response:
                return json.load(response)['entities']
        except (urllib.error.URLError,TimeoutError,KeyError,ValueError) as exc:
            print(f'Wikidata request failed (attempt {attempt+1}): {exc}',flush=True)
            if attempt==4:
                raise
            time.sleep(2**attempt)
    raise RuntimeError('Wikidata request failed')

def parse_sex(entity):
    claims=entity.get('claims',{}).get('P21',[])
    values=set()
    for claim in claims:
        snak=claim.get('mainsnak',{})
        value=snak.get('datavalue',{}).get('value',{})
        if isinstance(value,dict):
            values.add(value.get('id'))
    sexes={VALUES[v] for v in values if v in VALUES}
    return next(iter(sexes)) if len(sexes)==1 and len(values)==1 else None

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--snapshot',type=pathlib.Path,default=ROOT/'data/horse-pedigree.v1.json')
    ap.add_argument('--output-source',type=pathlib.Path,default=ROOT/'data/source/wikidata-sex-2026-11-13.json')
    ap.add_argument('--output-module',type=pathlib.Path,default=ROOT/'src/horse-sex-data.js')
    args=ap.parse_args()
    horses=json.loads(args.snapshot.read_text(encoding='utf-8'))['horses']
    ids=sorted({horse['id'] for horse in horses})
    sexes={}
    unresolved=[]
    for i in range(0,len(ids),40):
        chunk=ids[i:i+40]
        entities=request_claims(chunk)
        for qid in chunk:
            gender=parse_sex(entities.get(qid,{}))
            if gender:
                sexes[qid]=gender
            else:
                unresolved.append(qid)
        print(f'Checked {min(i+40,len(ids))}/{len(ids)}, confirmed {len(sexes)}',flush=True)
        time.sleep(.3)
    if not sexes:
        print('No explicit P21 claims; retaining only father/mother-role inference in the game.',flush=True)
    args.output_source.parent.mkdir(parents=True,exist_ok=True)
    args.output_module.parent.mkdir(parents=True,exist_ok=True)
    source={'retrievedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'method':'Wikidata wbgetentities P21, claims only',
            'license':'Wikidata CC0', 'sex':dict(sorted(sexes.items())),
            'unresolvedQids':unresolved}
    args.output_source.write_text(json.dumps(source,sort_keys=True,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    args.output_module.write_text("// Frozen from data/source/wikidata-sex-2026-11-13.json (Wikidata CC0).\n"
      +"export const wikidataSex = Object.freeze("
      +json.dumps(dict(sorted(sexes.items())),ensure_ascii=False,separators=(',',':'))
      +");\n",encoding='utf-8')
    print(f'SEX_AUDIT {len(sexes)}/{len(ids)} direct claims; unknown {len(unresolved)}',flush=True)

if __name__=='__main__':
    main()
