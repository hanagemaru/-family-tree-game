#!/usr/bin/env python3
"""Build a source-linked mother-name supplement from Wikimedia, not JBIS.

Only Wikidata QID-matched Wikipedia sitelinks are queried. No fuzzy horse name
search, no inferred identity, no copying non-free racing database pages.
Wikipedia article revision URLs are retained to credit authors and ease audits.
"""
import argparse
import html
import json
import re
import sys
import time
from collections import Counter
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / "data/horse-pedigree.v1.json"
AUDIT = ROOT / "data/source/wikipedia-dam-evidence.v1.json"
MODULE = ROOT / "src/horse-parent-evidence.js"
AGENT = "HanagePedigreeResearch/0.2 (Wikimedia sourced horse family-tree game; attribution in app)"
INVALID = re.compile(r"(?:不明|未詳|不詳|Unknown|None|\{\{|\}\}|\[\[|\]\]|\||[<>\n])",re.I)
MOTHER_FIELD = re.compile(
    r"(?im)^\s*\|\s*(?:母|母馬|dam|mother)\s*=\s*(.*?)\s*$"
)
REF_TAG = re.compile(r"<ref\b[^>]*(?:/>|>.*?</ref\s*>)", re.I | re.S)
HTML_TAG = re.compile(r"<[^>]*>", re.S)
WIKILINK_NAMED = re.compile(r"\[\[([^\]|]+)\|([^\]]+)\]\]")
WIKILINK_SIMPLE = re.compile(r"\[\[([^\]]+)\]\]")
NOTES = re.compile(r"\{\{(?:sfn|efn|ref|要出典|citation needed|cn|rp)[^{}]*\}\}", re.I)
SAFE_TEMPLATE = re.compile(r"\{\{(?:small|nowrap|nobr)\s*\|\s*([^{}|]+)\}\}", re.I)


def http_json(url, label):
    for attempt in range(4):
        try:
            req = Request(url,headers={"User-Agent":AGENT,"Accept":"application/json"})
            with urlopen(req, timeout=30) as response:
                return json.load(response)
        except (HTTPError, URLError, TimeoutError) as error:
            if attempt == 3:
                raise RuntimeError(f"{label}: {error}") from error
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"{label}: unexpected failure")


def api(host, params, label):
    return http_json(f"https://{host}/w/api.php?{urlencode(params)}", label)


def chunks(items, n):
    for i in range(0,len(items),n):
        yield items[i:i+n]


def wikidata_sitelinks(horses):
    result={}
    for batch in chunks(horses,45):
        payload=api("www.wikidata.org",{
            "action":"wbgetentities","ids":"|".join(h["id"] for h in batch),
            "props":"sitelinks","format":"json"
        },"Wikidata sitelinks")
        for qid,entity in payload.get("entities",{}).items():
            if "missing" in entity: continue
            sites=entity.get("sitelinks",{})
            result[qid]={lang:sites[f"{lang}wiki"]["title"]
                for lang in ("ja","en") if f"{lang}wiki" in sites}
        time.sleep(.22)
    return result


def clean_mother(raw):
    """Normalize an unambiguous infobox literal, never guess nested expressions."""
    text=re.sub(r"<!--.*?-->","",raw,flags=re.S)
    text=REF_TAG.sub("",text)
    text=NOTES.sub("",text)
    for _ in range(4):
        new=SAFE_TEMPLATE.sub(r"\1",text)
        if new==text: break
        text=new
    text=WIKILINK_NAMED.sub(r"\2",text)
    text=WIKILINK_SIMPLE.sub(r"\1",text)
    text=HTML_TAG.sub("",text)
    text=html.unescape(text).replace("'''","").replace("''","").strip()
    # Separate values or unparsed wiki structures are review-only.
    if not 2<=len(text)<=72 or INVALID.search(text): return None
    if text in {"-","—","?","なし","Unknown","No data"}: return None
    if any(s in text for s in ("；",";", " / ", "、","<br")): return None
    if re.match(r"^(?:\d+|http|www\.)",text,re.I): return None
    return " ".join(text.split())


def dam_from_article(wikitext):
    # Wikitext after the first article heading often contains unrelated
    # bloodline tables; limit extraction to opening infobox parameters.
    lead=re.split(r"(?m)^==[^=]",wikitext,maxsplit=1)[0][:23000]
    found=[]
    for match in MOTHER_FIELD.finditer(lead):
        result=clean_mother(match.group(1))
        if result: found.append(result)
    unique=list(dict.fromkeys(found))
    return unique[0] if len(unique)==1 else None


def wikipedia_revisions(pairs,lang,counts,limit):
    """
    pairs=(QID,title). Wikidata sitelinks, not name-search matches, establish
    identity. Only the first page per QID may be used.
    """
    records={}
    for index,batch in enumerate(chunks(pairs,8)):
        titles=[title for _,title in batch]
        payload=api(f"{lang}.wikipedia.org",{
            "action":"query","prop":"revisions","rvprop":"ids|content",
            "rvslots":"main","titles":"|".join(titles),
            "format":"json","formatversion":"2","redirects":"1"
        },f"{lang} Wikipedia revisions")
        pages=payload.get("query",{}).get("pages",[])
        bytitle={p.get("title",""):p for p in pages}
        redirects={r["from"]:r["to"] for r in payload.get("query",{}).get("redirects",[])}
        normalized={r["from"]:r["to"] for r in payload.get("query",{}).get("normalized",[])}
        for qid,title in batch:
            resolved=normalized.get(title,title)
            resolved=redirects.get(resolved,resolved)
            page=bytitle.get(resolved)
            if not page or page.get("missing"):
                counts[f"{lang}_article_missing"]+=1;continue
            rev=next(iter(page.get("revisions",[])),None)
            if not rev:
                counts[f"{lang}_revision_missing"]+=1;continue
            source=rev.get("slots",{}).get("main",{}).get("content","")
            dam=dam_from_article(source)
            if not dam:
                counts[f"{lang}_dam_not_unambiguous"]+=1;continue
            url=f"https://{lang}.wikipedia.org/wiki/{quote(page['title'].replace(' ','_'))}"
            records[qid]={"dam":dam,"wiki":lang,"url":url,
                          "revision":rev.get("revid"),"title":page["title"]}
            counts[f"{lang}_dam_found"]+=1
        if (index+1)%10==0:
            print(f"{lang} articles queried: {min(len(pairs),(index+1)*8)}/{len(pairs)}"
                  f"; accepted: {counts[f'{lang}_dam_found']}",flush=True)
        time.sleep(.24)
    return records


def generate_module(records):
    # JSON is valid JavaScript syntax for the named export.
    lines=[
        "/** Wikipedia (CC BY-SA 4.0) infobox fact references, keyed by Wikidata QID.",
        " * Each source URL links to the Wikipedia article and its author history.",
        " * Only literal mother names are reused; no prose or pedigree database",
        " * has been copied. Unambiguous Wikidata sitelinks establish identity.",
        " * Regenerate with: python scripts/harvest_wikipedia_dams.py",
        " */",
        "export const verifiedParentNames=Object.freeze("+json.dumps(records,ensure_ascii=False,
            sort_keys=True,indent=2)+");",
        "",
        "export function verifiedDamName(horse){",
        " const evidence=verifiedParentNames[horse?.id];",
        " return evidence&&horse.name===evidence.name&&horse.birthYear===evidence.year?",
        "   {name:evidence.dam,source:evidence.url}:null;",
        "}",
        ""
    ]
    return "\n".join(lines)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--limit",type=int,default=0)
    parser.add_argument("--dry-run",action="store_true")
    args=parser.parse_args()
    data=json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    all_missing=[h for h in data["horses"] if h.get("named") and h.get("dam") is None]
    missing=all_missing if args.limit<=0 else all_missing[:args.limit]
    counts=Counter()
    sitelinks=wikidata_sitelinks(missing)
    print("Wikidata sitelinks:",len(sitelinks),"for",len(missing),"missing dams",flush=True)
    verified={}
    for lang in ("ja","en"):
        wanted=[(h["id"],sitelinks[h["id"]][lang]) for h in missing
                if h["id"] not in verified and lang in sitelinks.get(h["id"],{})]
        counts[f"{lang}_eligible"]=len(wanted)
        records=wikipedia_revisions(wanted,lang,counts,args.limit)
        for horse in missing:
            claim=records.get(horse["id"])
            if not claim:continue
            claim.update({"name":horse["name"],"year":horse.get("birthYear")})
            verified[horse["id"]]=claim
    # Build runtime source with short, per-horse source references. Internal
    # JSON also records revision IDs and article titles for reproducibility.
    ordered=dict(sorted(verified.items()))
    audit={
        "schema":"wikipedia-dam-evidence.v1","snapshotVersion":data["version"],
        "license":"Article texts CC BY-SA 4.0; extracted horse names are factual metadata",
        "attribution":"Wikipedia article URLs link to the volunteer authors and revision history",
        "method":"Wikidata QID sitelinks; unambiguous mother field in Wikipedia infobox",
        "records":ordered,
        "counts":{"sourceMissing":len(all_missing),"scanned":len(missing),
                  "found":len(ordered),"unresolved":len(missing)-len(ordered),
                  **dict(sorted(counts.items()))}
    }
    print("RESULT COUNTS",json.dumps(audit["counts"],ensure_ascii=False),flush=True)
    for qid,record in list(ordered.items())[:10]:
        print("SAMPLE",qid,record["name"],"->",record["dam"],record["wiki"],flush=True)
    if not ordered:raise SystemExit("No unambiguous records from Wikimedia; refusing to erase existing source.")
    if args.dry_run:
        print("DRY RUN: no project files written")
        return
    AUDIT.parent.mkdir(parents=True,exist_ok=True)
    AUDIT.write_text(json.dumps(audit,ensure_ascii=False,sort_keys=True,indent=2)+"\n",encoding="utf-8")
    MODULE.write_text(generate_module(ordered),encoding="utf-8")
    print("UPDATED",str(AUDIT),str(MODULE),flush=True)


if __name__=="__main__":
    main()
