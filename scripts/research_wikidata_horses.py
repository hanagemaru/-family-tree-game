#!/usr/bin/env python3
"""Audit CC0 Wikidata horse pedigree coverage for a Japanese family-tree game.
Only reads Wikimedia public APIs with an identifiable User-Agent.
Does not ingest/rip any restricted commercial racing databases.
"""
import collections
import datetime
import html
import json
import pathlib
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/"artifacts"
OUT.mkdir(exist_ok=True)
UA="HanageFamilyTreeAudit/0.1 (https://github.com/hanagemaru/-family-tree-game; user-facing research)"
API="https://www.wikidata.org/w/api.php"
COMMONS_API="https://commons.wikimedia.org/w/api.php"
SPARQL="https://query.wikidata.org/sparql"
# The existing 24 horses constitute the baseline coverage check.
CURRENT=[
 "サンデーサイレンス","ウインドインハーヘア","ディープインパクト","ブラックタイド",
 "ステイゴールド","キズナ","コントレイル","ジェンティルドンナ","オルフェーヴル",
 "ゴールドシップ","キタサンブラック","イクイノックス","ハーツクライ","ダイワメジャー",
 "スペシャルウィーク","ブエナビスタ","サトノダイヤモンド","ラヴズオンリーユー",
 "グランアレグリア","フィエールマン","ラッキーライラック","オジュウチョウサン",
 "ソールオリエンス","ジェラルディーナ",
]
EXTRA=[
 "ウオッカ","ダイワスカーレット","アーモンドアイ","ロードカナロア",
 "シンボリルドルフ","トウカイテイオー","メジロマックイーン","ナリタブライアン",
 "テイエムオペラオー","エピファネイア","シーザリオ","ドウデュース",
 "クロフネ","キングカメハメハ","シンボリクリスエス","グラスワンダー",
]
NAMES=CURRENT+EXTRA
def request_json(url,params,accept="application/json"):
    query=urllib.parse.urlencode(params)
    full=url+"?"+query
    req=urllib.request.Request(full,headers={
        "User-Agent":UA,"Accept":accept,"Accept-Encoding":"gzip,deflate",
    })
    for attempt in range(2):
        try:
            with urllib.request.urlopen(req,timeout=45) as response:
                blob=response.read()
                if response.headers.get("Content-Encoding")=="gzip":
                    import gzip
                    blob=gzip.decompress(blob)
                return json.loads(blob.decode("utf-8"))
        except urllib.error.HTTPError as e:
            msg=e.read(360).decode("utf-8","replace")
            if e.code in (429,503) and attempt==0:
                time.sleep(min(int(e.headers.get("Retry-After","2")),5))
                continue
            raise RuntimeError(f"HTTP {e.code} {url}: {msg}")
    raise RuntimeError("requests exhausted")
def wdqs(query):
    j=request_json(SPARQL,{"query":query,"format":"json"},"application/sparql-results+json")
    return [{k:v["value"] for k,v in x.items()} for x in j["results"]["bindings"]]
def qid(v):
    if not v: return None
    q=v.rsplit("/",1)[-1]
    return q if q.startswith("Q") and q[1:].isdigit() else None
def wd_search(name):
    obj=request_json(API,{"action":"wbsearchentities","search":name,"language":"ja","uselang":"ja","type":"item","limit":"5","format":"json"})
    opts=obj.get("search",[])
    for o in opts:
        if o.get("label")==name:
            return o["id"]
    return None
def claims_one(ent,prop):
    return list(dict.fromkeys(
        s.get("mainsnak",{}).get("datavalue",{}).get("value",{}).get("id")
        for s in ent.get("claims",{}).get(prop,[])
        if isinstance(s.get("mainsnak",{}).get("datavalue",{}).get("value",{}),dict)
        and s.get("mainsnak",{}).get("datavalue",{}).get("value",{}).get("id")
    ))
def get_entities(qids):
    entities={}
    for start in range(0,len(qids),40):
        chunk=qids[start:start+40]
        if not chunk:continue
        ret=request_json(API,{"action":"wbgetentities","ids":"|".join(chunk),"props":"labels|claims","languages":"ja|en","languagefallback":"1","format":"json"})
        entities.update(ret.get("entities",{}))
        time.sleep(.08)
    return entities
def filenames(ent):
    return list(dict.fromkeys(
        s.get("mainsnak",{}).get("datavalue",{}).get("value")
        for s in ent.get("claims",{}).get("P18",[])
        if isinstance(s.get("mainsnak",{}).get("datavalue",{}).get("value"),str)
    ))
def audit_commons_images(names_to_id,entities):
    filenames_by_horse={n:filenames(entities.get(id,{})) for n,id in names_to_id.items()}
    unique=sorted({v for items in filenames_by_horse.values() for v in items})
    filedata={}
    errors=[]
    for offset in range(0,len(unique),4):
        files=unique[offset:offset+4]
        try:
            result=request_json(COMMONS_API,{"action":"query","format":"json","prop":"imageinfo",
               "iiprop":"url|extmetadata","titles":"|".join("File:"+n for n in files)})
            for page in result.get("query",{}).get("pages",{}).values():
                if page.get("missing"):continue
                f=page.get("title","").removeprefix("File:")
                info=(page.get("imageinfo") or [{}])[0]
                meta=info.get("extmetadata",{})
                get=lambda key:html.unescape(meta.get(key,{}).get("value",""))
                filedata[f]={"filename":f,"license":get("LicenseShortName"),"license_url":get("LicenseUrl"),
                             "artist":get("Artist"),"credit":get("Credit"),"page":info.get("descriptionurl"),
                             "image_url":info.get("url"),"attribution_required":get("AttributionRequired"),
                             "restrictions":get("Restrictions")}
        except Exception as e:
            errors.append(str(e)[:240]);break
        time.sleep(.18)
    records=[]
    for n,id in names_to_id.items():
        candidates=filenames_by_horse[n]
        source=filedata.get(candidates[0]) if candidates else None
        records.append({"horse":n,"qid":id,"filenames":candidates,"commons":source,
                        "license_verified":bool(source and source.get("license"))})
    return records,errors
def label(ent):
    labels=ent.get("labels",{})
    return labels.get("ja",labels.get("en",{})).get("value",ent.get("id","?"))
def main():
    methods=[]
    matches={}
    # One narrow SPARQL query for exact Japanese labels avoids fuzzy ambiguity.
    term=" ".join(json.dumps(n,ensure_ascii=False)+"@ja" for n in NAMES)
    query="SELECT DISTINCT ?horse ?name WHERE { VALUES ?name { "+term+" } ?horse rdfs:label ?name . ?horse wdt:P31/wdt:P279* wd:Q726 . }"
    try:
        bindings=wdqs(query)
        options=collections.defaultdict(set)
        for b in bindings:
            name=b["name"]; id=qid(b["horse"])
            if id: options[name].add(id)
        matches={k:next(iter(v)) for k,v in options.items() if len(v)==1}
        ambiguous={k:sorted(v) for k,v in options.items() if len(v)>1}
        methods.append(f"SPARQL exact-ja horse labels: {len(matches)}/{len(NAMES)} matched, {len(ambiguous)} ambiguous")
    except Exception as e:
        methods.append("SPARQL exact-ja labels FAILED: "+str(e)[:250])
        ambiguous={}
    # A small number of direct API searches recover gaps and keep the work reproducible.
    misses=[n for n in NAMES if n not in matches and n not in ambiguous]
    if len(misses)>35:
        misses=misses[:35]
        methods.append("Search fallback limited to 35 entities, so totals are lower bounds")
    for name in misses:
        try:
            id=wd_search(name)
            if id:matches[name]=id
        except Exception as e:
            methods.append("API lookup FAILED on "+name+": "+str(e)[:180])
            break
        time.sleep(.09)
    methods.append(f"Matched requested names: {len(matches)}/{len(NAMES)}")
    if not matches:
        raise RuntimeError("Neither WDQS nor Wikidata Action API returned any matching horses")
    # Localized seed lookup can match namesakes; P31 is checked and suspicious items flagged.
    all_entities=get_entities(sorted(set(matches.values())))
    parents=set()
    for ent in all_entities.values():
        for p in ("P22","P25"):
            parents.update(claims_one(ent,p))
    first_parents=get_entities(sorted(parents-set(all_entities)))
    all_entities.update(first_parents)
    grandparents=set()
    for ent in first_parents.values():
        for p in ("P22","P25"):
            grandparents.update(claims_one(ent,p))
    second_parents=get_entities(sorted(grandparents-set(all_entities)))
    all_entities.update(second_parents)
    # Inverse parent links add famous offspring. Output is deliberately capped.
    discovered=[]
    if "ディープインパクト" in matches:
        anchor=matches["ディープインパクト"]
        try:
            qry=f"SELECT DISTINCT ?horse WHERE {{ ?horse (wdt:P22|wdt:P25) wd:{anchor} . }} LIMIT 350"
            discovered=[qid(x["horse"]) for x in wdqs(qry)]
            discovered=[v for v in discovered if v]
            new=sorted(set(discovered)-set(all_entities))
            all_entities.update(get_entities(new))
            methods.append(f"Immediate Wikidata offspring of Deep Impact: {len(discovered)} (LIMIT 350)")
        except Exception as e:methods.append("offspring query FAILED: "+str(e)[:250])
    # All nodes are conservative: only names that Wikidata itself describes.
    records={}
    for id,ent in all_entities.items():
        if ent.get("missing"):continue
        records[id]={"id":id,"name":label(ent),"sire":claims_one(ent,"P22"),"dam":claims_one(ent,"P25"),
          "images":len(ent.get("claims",{}).get("P18",[])), "instanceOf":claims_one(ent,"P31"),
          "wd":f"https://www.wikidata.org/wiki/{id}"}
    # Undirected connectivity only via explicitly recorded father/mother properties.
    neighbors=collections.defaultdict(set)
    for id,row in records.items():
        for pid in row["sire"]+row["dam"]:
            if pid in records:
                neighbors[id].add(pid); neighbors[pid].add(id)
    def component(start):
        found={start};queue=collections.deque([start])
        while queue:
            p=queue.popleft()
            for n in neighbors[p]-found:found.add(n);queue.append(n)
        return found
    reference=matches.get("ディープインパクト")
    connected=component(reference) if reference in records else set()
    original=[(n,matches[n]) for n in CURRENT if n in matches and matches[n] in records]
    # "Known parent" means Wikidata claims are present, not necessarily parent nodes also stored.
    stats={
        "current_count":len(CURRENT),"extra_count":len(EXTRA),
        "current_found":len(original),
        "current_sire_claim":sum(bool(records[id]["sire"]) for _,id in original),
        "current_dam_claim":sum(bool(records[id]["dam"]) for _,id in original),
        "current_both_claims":sum(bool(records[id]["sire"] and records[id]["dam"]) for _,id in original),
        "current_with_image_reference":sum(bool(records[id]["images"]) for _,id in original),
        "current_connected_to_deep":sum(id in connected for _,id in original),
        "all_fetched_entities":len(records),
        "linked_graph_component_size":len(connected),
        "offspring_discovered":len(discovered),
        "candidate_named_in_seed_set":sum(id in connected for id in matches.values()),
    }
    current_ids={n:matches[n] for n in CURRENT if n in matches}
    image_audit,image_errors=audit_commons_images(current_ids,all_entities)
    licenses=collections.Counter(x["commons"]["license"] for x in image_audit if x["commons"] and x["commons"].get("license"))
    stats["image_licenses_verified"]=sum(x["license_verified"] for x in image_audit)
    stats["image_license_types"]=dict(licenses)
    methods.extend("Commons image metadata error: "+e for e in image_errors)
    status=[]
    for n in NAMES:
        id=matches.get(n)
        r=records.get(id) if id else None
        status.append({"name":n,"qid":id,"sire":r["sire"] if r else [],"dam":r["dam"] if r else [],
                       "connected_to_deep":id in connected,"image_reference":bool(r and r["images"]),
                       "missing":not bool(r)})
    document={"retrieved_at_utc":datetime.datetime.now(datetime.timezone.utc).isoformat(),
              "methods":methods,"stats":stats,"horses":status,"ambiguous_labels":ambiguous,
              "entities":records,"image_audit":image_audit}
    (OUT/"wikidata-horse-audit.json").write_text(json.dumps(document,ensure_ascii=False,indent=2),encoding="utf-8")
    md=[
        "# Wikidata競走馬・血統データ検証（自動取得）",
        "",
        "検証時刻："+document["retrieved_at_utc"],"",
        "## 実測結果",
        "",
        "| 指標 | 実数 |","|---|---:|",
        *[f"| {k} | {v} |" for k,v in stats.items()],
        "","## 今の24頭の父母情報（Wikidata）","","| 競走馬 | QID | 父 | 母 | Deepと連結 | 画像参照 |","|---|---|---|---|---|---|",
        *[f"| {x['name']} | {x['qid'] or '未取得'} | {'有' if x['sire'] else '欠損'} | {'有' if x['dam'] else '欠損'} | {'はい' if x['connected_to_deep'] else 'いいえ'} | {'有' if x['image_reference'] else '無'} |" for x in status[:len(CURRENT)]],
        "","## 取得方法・注意","","- 父はP22、母はP25。親を2世代まで再帰的に取得、ディープの子はSPARQLから上限350件。","- 出典はWikidataのCC0構造化データ。参照URLは各QID。","- 父母の数値はWikidataの記録の有無であり、正確さを別途史料確認する必要がある。","- Wikidata P18は画像の参照のみ。画像の著作権や再利用許諾を示すものではない。","- 一部だけの連結成分を数えたもので、データベース全体の頭数ではない。","- 名称と個体の重複は再検証が必要。","",
        "## 競走馬24頭の画像ライセンス", "",
        "| 馬名 | 画像名 | ライセンス | ファイルのページ |","|---|---|---|---|",
        *[f"| {x['horse']} | {x['filenames'][0] if x['filenames'] else 'なし'} | {x['commons']['license'] if x['commons'] else '未確認'} | {x['commons']['page'] if x['commons'] else ''} |" for x in image_audit],
        "","ライセンスはCommonsの個別ファイルのメタデータに基づく。作者表記、利用条件、改変時の共有条件は画像採用前に確認する。","",
        "## APIの状況","",*[f"- {x}" for x in methods],
    ]
    (OUT/"wikidata-horse-audit.md").write_text("\n".join(md)+"\n",encoding="utf-8")
    print("WIKIDATA_AUDIT_RESULT="+json.dumps(stats,ensure_ascii=False,sort_keys=True))
    print("WIKIDATA_AUDIT_METHODS="+json.dumps(methods,ensure_ascii=False))
    print("WIKIDATA_MISSING_SEEDS="+json.dumps([x["name"] for x in status[:len(CURRENT)] if x["missing"]],ensure_ascii=False))
    print("WIKIDATA_DAM_MISSING_SEEDS="+json.dumps([x["name"] for x in status[:len(CURRENT)] if not x["dam"]],ensure_ascii=False))
    print("WIKIDATA_QIDS="+json.dumps({x["name"]:x["qid"] for x in status[:len(CURRENT)]},ensure_ascii=False))
    print("WIKIDATA_AMBIGUOUS="+json.dumps(ambiguous,ensure_ascii=False))
    print("WIKIDATA_IMAGE_LICENSES="+json.dumps(dict(licenses),ensure_ascii=False))
    print("WIKIDATA_IMAGE_ERRORS="+json.dumps(image_errors,ensure_ascii=False))
    print("Wrote artifacts/wikidata-horse-audit.md and .json")
if __name__=="__main__":
    try:main()
    except Exception as e:
        print("WIKIDATA_AUDIT_FAILURE="+repr(e),file=sys.stderr)
        raise
