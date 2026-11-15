#!/usr/bin/env python3
"""Collect reusable, individually credited horse photos from Wikimedia APIs."""
import collections, datetime, html, json, pathlib, re, time
import urllib.error, urllib.parse, urllib.request

ROOT=pathlib.Path(__file__).resolve().parents[1]
UA="HanageHorsePhotoAudit/0.1 (https://github.com/hanagemaru/-family-tree-game)"
DATA=ROOT/"data/horse-pedigree.v1.json"
MEDIA=ROOT/"data/horse-media.v1.json"
REPORT=ROOT/"docs/horse-photo-collection-2026-11-15.md"
WIKIDATA="https://www.wikidata.org/w/api.php"
COMMONS="https://commons.wikimedia.org/w/api.php"
WIKIPEDIAS={"jawiki":"https://ja.wikipedia.org/w/api.php","enwiki":"https://en.wikipedia.org/w/api.php"}
JPEG=re.compile(r"\.(?:jpe?g|webp)$",re.I)
GENERIC=re.compile(r"request.?picture|placeholder|no.?photo|not.?available|image.?missing",re.I)
def is_photo_candidate(filename):return bool(JPEG.search(filename) and not GENERIC.search(filename))
LICENSE=re.compile(r"^(CC BY(?:-SA)? [234]\.0|CC0(?: 1\.0)?|Public domain)$",re.I)

def batch(items,n):
    for i in range(0,len(items),n):yield items[i:i+n]

def fetch(url,params):
    req=urllib.request.Request(url+"?"+urllib.parse.urlencode(params),headers={"User-Agent":UA,"Accept":"application/json"})
    for i in range(4):
        try:
            with urllib.request.urlopen(req,timeout=50) as result:return json.load(result)
        except (urllib.error.HTTPError,urllib.error.URLError,TimeoutError) as e:
            code=getattr(e,"code",0)
            if code not in (0,429,500,502,503,504) or i==3:raise
            time.sleep((i+1)*2)

def clean(value,n=300):
    return re.sub(r"\s+"," ",re.sub(r"<[^>]+>"," ",html.unescape(str(value or "")))).strip()[:n]

def photo_claims(row):
    return list(dict.fromkeys(v.get("mainsnak",{}).get("datavalue",{}).get("value")
        for v in row.get("claims",{}).get("P18",[])
        if isinstance(v.get("mainsnak",{}).get("datavalue",{}).get("value"),str)))

def main():
    snap=json.loads(DATA.read_text("utf-8"))
    horses=[r for r in snap["horses"] if r["named"]]
    errors=[];entities={}
    for i,ids in enumerate(batch([r["id"] for r in horses],30)):
        try:
            result=fetch(WIKIDATA,{"action":"wbgetentities","ids":"|".join(ids),
               "props":"claims|sitelinks","sitefilter":"jawiki|enwiki","format":"json"})
            entities.update(result.get("entities",{}))
        except Exception as e:errors.append(f"Wikidata {i}: {type(e).__name__}: {str(e)[:130]}")
        time.sleep(.12)
    choices={r["id"]:[] for r in horses}
    wiki_titles=collections.defaultdict(dict)
    for horse in horses:
        qid=horse["id"];entity=entities.get(qid,{})
        choices[qid]+=[(filename,"Wikidata P18") for filename in photo_claims(entity) if is_photo_candidate(filename)]
        if not choices[qid]:
            for wiki in WIKIPEDIAS:
                title=entity.get("sitelinks",{}).get(wiki,{}).get("title")
                if title:wiki_titles[wiki][title]=qid
    for wiki,lookup in wiki_titles.items():
        for i,titles in enumerate(batch(sorted(lookup),30)):
            try:
                result=fetch(WIKIPEDIAS[wiki],{"action":"query","format":"json","redirects":"1",
                     "prop":"pageimages","piprop":"name","titles":"|".join(titles)})
                found={p["title"]:p["pageimage"] for p in result.get("query",{}).get("pages",{}).values()
                     if p.get("pageimage")}
                for redirect in result.get("query",{}).get("redirects",[]):
                    if redirect["to"] in found:found[redirect["from"]]=found[redirect["to"]]
                for title,filename in found.items():
                    if title in lookup and is_photo_candidate(filename):
                        choices[lookup[title]].append((filename,wiki+" pageimages"))
            except Exception as e:errors.append(f"{wiki} {i}: {type(e).__name__}: {str(e)[:130]}")
            time.sleep(.12)
    # A single generic or mixed-subject image used for multiple horse QIDs is not
    # adequate proof of each animal's identity. Suppress shared images.
    occurrence=collections.Counter(filename for values in choices.values()
         for filename,origin in set(values))
    shared={filename for filename,count in occurrence.items() if count>1}
    for qid in choices:
        choices[qid]=[(filename,origin) for filename,origin in choices[qid] if filename not in shared]
    filenames=sorted({filename for arr in choices.values() for filename,origin in arr})
    by_filename={}
    for i,part in enumerate(batch(filenames,6)):
        try:
            result=fetch(COMMONS,{"action":"query","format":"json","prop":"imageinfo",
                "iiprop":"url|extmetadata|mime|size","iiurlwidth":"320",
                "titles":"|".join("File:"+n for n in part)})
            for p in result.get("query",{}).get("pages",{}).values():
                info=(p.get("imageinfo") or [None])[0]
                if not info or "missing" in p:continue
                meta=info.get("extmetadata") or {}
                get=lambda k:clean(meta.get(k,{}).get("value"))
                filename=p.get("title","").removeprefix("File:")
                license_short=get("LicenseShortName")
                author=get("Attribution") or get("Artist") or get("Credit")
                photo_url=info.get("thumburl") or info.get("url") or ""
                allowed=bool(LICENSE.fullmatch(license_short) and
                    get("NonFree").lower() not in ("true","1") and
                    photo_url.startswith(("https://upload.wikimedia.org/","https://thumb.wikimedia.org/")) and
                    info.get("mime") in ("image/jpeg","image/webp") and
                    (author or license_short.lower().startswith(("public domain","cc0"))))
                by_filename[filename]={"filename":filename,"photoUrl":photo_url,
                    "filePage":info.get("descriptionurl",""),"license":license_short,
                    "licenseUrl":clean(meta.get("LicenseUrl",{}).get("value"),500),
                    "artist":author,"allowed":allowed,"mime":info.get("mime"),"nonfree":get("NonFree")}
        except Exception as e:errors.append(f"Commons {i}: {type(e).__name__}: {str(e)[:130]}")
        time.sleep(.23)
    approved={};rejected=collections.Counter();origin_stats=collections.Counter()
    for horse in horses:
        qid=horse["id"]
        for filename,origin in dict.fromkeys(choices[qid]):
            info=by_filename.get(filename)
            if info and info["allowed"]:
                approved[qid]={k:info[k] for k in ("filename","photoUrl","filePage","license","licenseUrl","artist")}
                approved[qid].update(name=horse["name"],source=origin)
                origin_stats[origin]+=1
                break
            if info:rejected[info["license"] or "unknown license"]+=1
    now=datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    output={"version":"horse-photo-v1","retrievedAtUTC":now,
       "datasetVersion":snap["version"],
       "licensePolicy":"Wikimedia Commons CC BY/CC BY-SA/CC0/Public domain; photograph association from Wikidata/Wikipedia, not individually visual-verified.",
       "horses":dict(sorted(approved.items()))}
    MEDIA.write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n","utf-8")
    debug=[{"file":k,"license":v["license"],"mime":v.get("mime"),"artist":bool(v["artist"]),"urlStart":v["photoUrl"][:75],"nonfree":v.get("nonfree")} for k,v in by_filename.items() if not v["allowed"]][:6]
    stats={"named":len(horses),"wikidataFound":len(entities),"photoFiles":len(filenames),"sampleRejected":debug,
       "approved":len(approved),"coveragePercent":round(len(approved)*100/len(horses),1),"sharedImagesExcluded":len(shared),
       "origin":dict(origin_stats),"licenseRejected":dict(rejected),"errors":errors}
    lines=["# 競走馬写真のライセンス照合（Wikimedia Commons）","",
      f"取得日時：{now}（UTC）","",f"- 対象：{len(horses)}頭",
      f"- Wikidata照合：{len(entities)}頭",f"- Commons候補：{len(filenames)}ファイル",
      f"- 複数馬に使い回された画像：{len(shared)}ファイル除外（同一個体か検証できないため）",
      f"- **ライセンス確認済みの写真候補：{len(approved)}頭（{stats['coveragePercent']}%）**",
      f"- 取得経路：{dict(origin_stats)}",
      f"- 不適合・不明ライセンス：{dict(rejected)}","",
      "写真はCommonsのサムネイルURLを参照。各写真の撮影者・出典・ライセンスはゲーム内で明示する。",
      "馬との紐付けはWikidataのP18またはWikipediaのページ画像。**写っている馬の個体を目視で保証するものではありません。**",
      "権利不明・利用条件不明・画像なしの場合は元の馬イラストを使う。",
      "著作権フリーでも肖像権・商標などの別の権利までクリアしたと保証しない。","",
      "## 収集エラー",""]
    lines += [f"- {e}" for e in errors[:30]] or ["- なし"]
    lines += ["","## 採用候補（初回25頭）","","| 馬名 | ライセンス | 写真ファイル |","|---|---|---|"]
    for row in list(approved.values())[:25]:
        lines.append(f"| {row['name']} | {row['license']} | [{row['filename']}]({row['filePage']}) |")
    REPORT.write_text("\n".join(lines)+"\n","utf-8")
    print("HORSE_MEDIA_RESULT="+json.dumps(stats,ensure_ascii=False))
    if len(entities)<len(horses)*.8 or not approved:
        raise RuntimeError("Insufficient Wikimedia data, do not publish")
if __name__=="__main__":main()
