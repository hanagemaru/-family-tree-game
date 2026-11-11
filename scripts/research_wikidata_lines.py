#!/usr/bin/env python3
"""Measure non-Deep thoroughbred family networks in CC0 Wikidata.
Data: recorded P22/P25 relations (not total real-world foals).
"""
import collections
import datetime
import json
import pathlib
import sys
import time
from research_wikidata_horses import wdqs, qid, get_entities, claims_one, label

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/"artifacts";OUT.mkdir(exist_ok=True)
# Sire-line comparison anchors, plus dams whose offspring would make a distinct mode.
ROOTS=[
 ("サンデーサイレンス","Sunday Silence / サンデー系"),
 ("ディープインパクト","Deep Impact / サンデー系"),
 ("キングカメハメハ","King Kamehameha / ミスプロ系"),
 ("ロードカナロア","Lord Kanaloa / キンカメ系"),
 ("ブライアンズタイム","Brian's Time / ロベルト系"),
 ("シンボリクリスエス","Symboli Kris S / ロベルト系"),
 ("グラスワンダー","Grass Wonder / ロベルト系"),
 ("トニービン","Tony Bin / ナスルーラ系"),
 ("ノーザンテースト","Northern Taste / ノーザンダンサー系"),
 ("クロフネ","Kurofune / ノーザンダンサー系"),
 ("シンボリルドルフ","Symboli Rudolf / 古典的父系"),
 ("シーザリオ","Cesario / 母系"),
 ("ウオッカ","Vodka / 母系"),
]
# Validate notable proposed sire lines using father claims, not assumptions.
NOTABLE=[
 "アーモンドアイ","ドゥラメンテ","エピファネイア","ナリタブライアン",
 "ジャングルポケット","トウカイテイオー","モーリス","スクリーンヒーロー",
 "リオンディーズ","サートゥルナーリア","キタサンブラック","イクイノックス",
 "ナリタトップロード","カレンチャン","キングヘイロー","メジロマックイーン",
]
def resolve_names(names):
    term=" ".join(json.dumps(n,ensure_ascii=False)+"@ja" for n in names)
    query="SELECT DISTINCT ?horse ?name WHERE { VALUES ?name { "+term+" } ?horse rdfs:label ?name . ?horse wdt:P31/wdt:P279* wd:Q726 . }"
    hits=collections.defaultdict(set)
    for b in wdqs(query):
        horse=qid(b["horse"])
        if horse: hits[b["name"]].add(horse)
    exact={name:next(iter(found)) for name,found in hits.items() if len(found)==1}
    conflicts={name:sorted(found) for name,found in hits.items() if len(found)>1}
    return exact,conflicts
def query_direct_children(ids):
    ids=sorted(set(ids))
    query="SELECT DISTINCT ?parent ?child ?prop WHERE { VALUES ?parent { "+" ".join("wd:"+x for x in ids)+" } VALUES ?prop { wdt:P22 wdt:P25 } ?child ?prop ?parent . } LIMIT 15000"
    rows=wdqs(query)
    out=collections.defaultdict(lambda:{"sire":set(),"dam":set()})
    for row in rows:
        p=qid(row.get("parent",""));c=qid(row.get("child",""))
        prop=row.get("prop","").split("/")[-1]
        if p and c and prop in ("P22","P25"):
            out[p]["sire" if prop=="P22" else "dam"].add(c)
    return out,len(rows)==15000
def main():
    root_names=[n for n,_ in ROOTS]
    names=root_names+NOTABLE
    matches,ambiguous=resolve_names(names)
    roots={name:matches[name] for name in root_names if name in matches}
    missing=[name for name in root_names if name not in roots]
    if len(roots)<7:
        raise RuntimeError("Too few anchors found: "+str(roots)+", ambiguous="+str(ambiguous)+", missing="+str(missing))
    children=collections.defaultdict(lambda:{"sire":set(),"dam":set()})
    limits=[]
    for n in range(0,len(roots),3):
        chunk=list(roots.values())[n:n+3]
        batch,truncated=query_direct_children(chunk)
        limits.append({"qids":chunk,"truncated":truncated})
        for k,v in batch.items():
            children[k]["sire"].update(v["sire"])
            children[k]["dam"].update(v["dam"])
        time.sleep(.2)
    # Lookup known notable horses and their parents to verify 2-3-generation chains.
    lookup=set(matches.values())
    ents=get_entities(sorted(lookup))
    extra=set()
    for e in ents.values():
        extra.update(claims_one(e,"P22"));extra.update(claims_one(e,"P25"))
    ents.update(get_entities(sorted(extra-set(ents))))
    # Name direct foals only when available from notable list or internal parent IDs.
    focal=[]
    for name,group in ROOTS:
        id=roots.get(name)
        if not id:
            focal.append({"name":name,"group":group,"qid":None,"direct_total":0,"direct_sire":0,"direct_dam":0,"known_famous_offspring":[]})
            continue
        child=children[id];direct=child["sire"]|child["dam"]
        hits=[n for n,x in matches.items() if n not in root_names and x in direct]
        also=[n for n,x in roots.items() if n!=name and x in direct]
        focal.append({"name":name,"group":group,"qid":id,"direct_total":len(direct),
                     "direct_sire":len(child["sire"]),"direct_dam":len(child["dam"]),
                     "known_famous_offspring":sorted(set(hits+also))})
    relationships=[]
    for name in names:
        id=matches.get(name)
        ent=ents.get(id,{})
        sire=claims_one(ent,"P22")
        dam=claims_one(ent,"P25")
        relationships.append({"name":name,"qid":id,
           "sire": [{"qid":x,"name":label(ents.get(x,{"id":x}))} for x in sire],
           "dam": [{"qid":x,"name":label(ents.get(x,{"id":x}))} for x in dam]})
    summary={
        "requested_roots":len(root_names),
        "roots_resolved":len(roots),
        "direct_foals_by_root":{item["name"]:item["direct_total"] for item in focal},
        "total_unique_direct_foals_across_roots":len(set().union(*(x["sire"]|x["dam"] for x in children.values()))),
        "all_root_query_batches_complete":not any(x["truncated"] for x in limits),
    }
    out={
        "retrieved_at_utc":datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "source":"Wikidata SPARQL P22/P25 public direct-property claims",
        "limitations":"Wikidata recorded offspring are incomplete; counts do NOT represent all offspring in reality. Father-line classification labels are illustrative and require independent validation.",
        "summary":summary,"root_groups":focal,"named_pedigrees":relationships,
        "ambiguous_labels":ambiguous,"missing_names":[n for n in names if n not in matches],
        "truncation":limits,
        "foal_qids_by_root":{name:{"sire":sorted(children[id]["sire"]),"dam":sorted(children[id]["dam"])} for name,id in roots.items()},
    }
    (OUT/"wikidata-lineage-audit.json").write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding="utf-8")
    md=["# 競走馬の複数系統におけるWikidata血統カバー率（実測）",
        "","取得："+out["retrieved_at_utc"],"",
        "**注：子の数はWikidataがP22/P25で記録した直属の子の数。実際の産駒総数ではない。**",
        "","| 起点 | 分類（説明用） | Wikidataで子として登録された頭数 | 父として | 母として |","|---|---|---:|---:|---:|"]
    for x in focal:
        md.append(f"| {x['name']} | {x['group']} | {x['direct_total']} | {x['direct_sire']} | {x['direct_dam']} |")
    md+=["","## 注目馬の父母（Wikidata記録）","","| 馬名 | 父 | 母 |","|---|---|---|"]
    for x in relationships:
        md.append(f"| {x['name']} | {', '.join(p['name'] for p in x['sire']) or '未記録'} | {', '.join(p['name'] for p in x['dam']) or '未記録'} |")
    md+=["","## 解釈上の注意","",
         "- 何頭が直接記録されているかと、24枚の面白い連結問題が作れるかは別問題。",
         "- 有名種牡馬が非父系の共通祖先でつながっても、父系分類が同じとは限らない。",
         "- 複数系統の馬同士は母方経由でつながる可能性があるため、家系図モードでは父母辺で計算する。",
         "- 個体ID・親子の真偽・母系の欠落は別資料と照合する必要がある。",
         "- 今回は1世代（直属の子）の件数を比較。2〜3世代の十分な広がりは次の検証。",
         "- クレジットの必要な画像のライセンス調査は別レポートに記載。",
         "","## 実行結果","",f"- 指定13起点の解決：{summary['roots_resolved']}/13",
         f"- 起点の子のQIDユニーク数：{summary['total_unique_direct_foals_across_roots']}",
         f"- クエリ切り捨て無し：{'はい' if summary['all_root_query_batches_complete'] else 'いいえ'}",
         f"- 解決できない起点：{', '.join(missing) if missing else 'なし'}",""]
    (OUT/"wikidata-lineage-audit.md").write_text("\n".join(md),encoding="utf-8")
    print("LINEAGE_AUDIT_RESULT="+json.dumps(summary,ensure_ascii=False))
    print("LINEAGE_AUDIT_ROOTS="+json.dumps(focal,ensure_ascii=False))
    print("LINEAGE_AUDIT_MISSING="+json.dumps(out["missing_names"],ensure_ascii=False))
    print("LINEAGE_AUDIT_SAMPLE_PARENTS="+json.dumps([{k:r[k] for k in ("name","qid","sire","dam")} for r in relationships if r["name"] in ("アーモンドアイ","ドゥラメンテ","ナリタブライアン","トウカイテイオー","エピファネイア","ジャングルポケット")],ensure_ascii=False))
    print("Wrote artifacts/wikidata-lineage-audit.md and .json")
if __name__=="__main__":
    try:main()
    except Exception as e:
        print("LINEAGE_AUDIT_FAILED="+repr(e),file=sys.stderr)
        raise
