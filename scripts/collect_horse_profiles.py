#!/usr/bin/env python3
"""Research all 872 named racehorses from Wikidata claims + Wikipedia lead text.

Only discrete, identifiable racing facts are extracted and stored. No Wikipedia
prose is reproduced. Existing QIDs and article URLs keep attribution auditable.
No missing fact is invented or replaced with a guessed parentage/achievement.
"""
import collections, datetime, html, json, pathlib, re, time
import urllib.error, urllib.parse, urllib.request

ROOT=pathlib.Path(__file__).resolve().parents[1]
PEDIGREE=ROOT/"data/horse-pedigree.v1.json"
FAME=ROOT/"data/horse-fame-2026-10.v1.json"
OUTPUT=ROOT/"data/horse-profiles.v1.json"
REPORT=ROOT/"docs/horse-profile-audit-2026-11-16.md"
UA="HanageHorseProfileCollector/0.1 (https://github.com/hanagemaru/-family-tree-game)"
WIKIDATA="https://www.wikidata.org/w/api.php"
WIKIPEDIA={"ja":"https://ja.wikipedia.org/w/api.php","en":"https://en.wikipedia.org/w/api.php"}
RACES=[
 "朝日杯フューチュリティステークス","阪神ジュベナイルフィリーズ","ジャパンカップ",
 "日本ダービー","東京優駿","皐月賞","菊花賞","桜花賞","優駿牝馬","オークス",
 "秋華賞","有馬記念","宝塚記念","天皇賞","大阪杯","安田記念",
 "ヴィクトリアマイル","NHKマイルカップ","マイルチャンピオンシップ",
 "スプリンターズステークス","高松宮記念","エリザベス女王杯",
 "ホープフルステークス","フェブラリーステークス","チャンピオンズカップ",
 "東京大賞典","帝王賞","川崎記念","かしわ記念","JBCクラシック","JBCスプリント",
 "全日本2歳優駿","ダービーグランプリ","東京ダービー","中山グランドジャンプ",
 "中山大障害","京都大賞典","日経賞","阪神大賞典","神戸新聞杯",
 "弥生賞","スプリングステークス","セントライト記念","ローズステークス",
 "京都新聞杯","目黒記念","中山金杯","金鯱賞","オールカマー",
 "京都記念","毎日王冠","札幌記念","函館記念","アメリカジョッキークラブカップ",
 "大阪杯","青葉賞","ダイヤモンドステークス","小倉大賞典",
 "アーリントンカップ","共同通信杯","フラワーカップ","デイリー杯2歳ステークス",
 "シンザン記念","鳴尾記念","福島記念","函館スプリントステークス",
 "香港ヴァーズ","香港カップ","香港マイル","香港スプリント",
 "ドバイシーマクラシック","ドバイターフ","ドバイワールドカップ",
 "凱旋門賞","キングジョージ6世&クイーンエリザベスステークス",
 "ブリーダーズカップ・ターフ","ブリーダーズカップ・クラシック","メルボルンカップ",
 "プリンスオブウェールズステークス","クイーンエリザベス2世カップ",
 "天皇賞（春）","天皇賞（秋）",
]
# Longer names must be recognized before their shorter prefix.
RACES=sorted(set(RACES),key=len,reverse=True)
RACE_PATTERN=re.compile("|".join(map(re.escape,RACES)))
RECORD_PATTERN=re.compile(r"(?:通算(?:成績|戦績)?|競走成績|生涯成績|全成績)[：:\sは、]*([0-9]{1,3})戦([0-9]{1,3})勝")
CLAUSE_PATTERN=re.compile(r"(?:主な勝ち鞍|主な勝鞍|おもな勝ち鞍|主な優勝|主な勝利)(?:として)?(?:は|に|：|:)?(.{0,500}?)(?:。|\n|$)")
QID_PATTERN=re.compile(r"^Q[1-9][0-9]*$")
def batches(items,n):
    for start in range(0,len(items),n):
        yield items[start:start+n]
def get(url,params):
    params={"format":"json",**params}
    request=urllib.request.Request(url+"?"+urllib.parse.urlencode(params),headers={"User-Agent":UA,"Accept":"application/json"})
    for i in range(4):
        try:
            with urllib.request.urlopen(request,timeout=45) as response:return json.load(response)
        except (urllib.error.HTTPError,urllib.error.URLError,TimeoutError) as e:
            if getattr(e,"code",0) not in (0,429,500,502,503,504) or i>=3:raise
            time.sleep(2*(i+1))
    raise RuntimeError("unexpected request loop")

def item_claims(entity,property_id):
    result=[]
    for claim in entity.get("claims",{}).get(property_id,[]):
        if claim.get("rank")=="deprecated":continue
        value=claim.get("mainsnak",{}).get("datavalue",{}).get("value",{})
        if not isinstance(value,dict) or value.get("entity-type")!="item":continue
        qid=value.get("id")
        if not isinstance(qid,str) or not QID_PATTERN.fullmatch(qid):continue
        year=None
        for qualifier in claim.get("qualifiers",{}).get("P585",[]):
            date=qualifier.get("datavalue",{}).get("value",{}).get("time","")
            matched=re.match(r"\+?(\d{4})-",date)
            if matched:year=int(matched[1])
        result.append({"qid":qid,"year":year})
    return result

def wiki_lead(text):
    # If the article has no explicit win-list wording, do not mistake a race
    # that was merely mentioned (a defeat, entry, or parent's victory) for a win.
    text=html.unescape(text or "")
    match=CLAUSE_PATTERN.search(text)
    wins=[]
    if match:
        clause=match[1].replace("（","(").replace("）",")")
        # Prefer exact race name matches; do not infer first place from prose.
        for m in RACE_PATTERN.finditer(clause):
            name=m.group()
            # Avoid turning a different named local prize (e.g. 兵庫菊花賞)
            # into the national classic 菊花賞 just because of a substring.
            if m.start() and re.match(r"[ぁ-んァ-ヴ一-龠]",clause[m.start()-1]) and clause[m.start()-1] not in ("年","の","回"):
                continue
            if not any(x["race"]==name for x in wins):wins.append({"race":name,"year":None})
        wins=wins[:8]
    record=RECORD_PATTERN.search(text[:1150])
    races=int(record[1]) if record else None
    victories=int(record[2]) if record else None
    if races is not None and not (0<=victories<=races<=200):
        races=victories=None
    return wins,({"starts":races,"wins":victories} if races is not None else None)

def main():
    snapshot=json.loads(PEDIGREE.read_text("utf8"))
    fame=json.loads(FAME.read_text("utf8"))
    named=[h for h in snapshot["horses"] if h.get("named")]
    assert len(named)==872
    byFame={h["id"]:h for h in fame["horses"]}
    errors=[];entities={}
    for n,part in enumerate(batches([h["id"] for h in named],35)):
        try:
            data=get(WIKIDATA,{"action":"wbgetentities","ids":"|".join(part),
             "props":"claims|sitelinks|descriptions","sitefilter":"jawiki|enwiki",
             "languages":"ja|en"})
            entities.update(data.get("entities",{}))
        except Exception as e:errors.append("Wikidata "+str(n)+": "+str(e)[:140])
        time.sleep(.1)
    rawWins={id:item_claims(entity,"P2522") for id,entity in entities.items()}
    winQids=sorted({w["qid"] for values in rawWins.values() for w in values})
    winLabels={}
    for n,part in enumerate(batches(winQids,50)):
        try:
            data=get(WIKIDATA,{"action":"wbgetentities","ids":"|".join(part),
                "props":"labels","languages":"ja|en"})
            for id,entity in data.get("entities",{}).items():
                labels=entity.get("labels",{})
                label=(labels.get("ja") or labels.get("en") or {}).get("value")
                if label:winLabels[id]=label
        except Exception as e:errors.append("Win labels "+str(n)+": "+str(e)[:140])
        time.sleep(.1)
    wikiLookup=collections.defaultdict(dict)
    for horse in named:
        fameRow=byFame.get(horse["id"],{})
        project=fameRow.get("project","")
        article=fameRow.get("article")
        wiki="ja" if project=="ja.wikipedia.org" else "en" if project=="en.wikipedia.org" else None
        if wiki and article:wikiLookup[wiki][article]=horse["id"]
    wikiExtracts={}
    for wiki,titleMap in wikiLookup.items():
        for n,part in enumerate(batches(sorted(titleMap),15)):
            try:
                data=get(WIKIPEDIA[wiki],{
                 "action":"query","prop":"extracts","exintro":"1","explaintext":"1",
                 "exchars":"1150","exlimit":"max","redirects":"1","titles":"|".join(part)
                })
                pages=data.get("query",{}).get("pages",{})
                normalized={x.get("from"):x.get("to") for x in data.get("query",{}).get("normalized",[])}
                redirects={x.get("from"):x.get("to") for x in data.get("query",{}).get("redirects",[])}
                titleTexts={p.get("title"):p.get("extract","") for p in pages.values() if p.get("extract")}
                for title in part:
                    canonical=redirects.get(normalized.get(title,title),normalized.get(title,title))
                    txt=titleTexts.get(canonical) or titleTexts.get(title)
                    if txt:wikiExtracts[titleMap[title]]=txt
            except Exception as e:errors.append(wiki+" extract "+str(n)+": "+str(e)[:140])
            time.sleep(.15)
    profiles={};counters=collections.Counter()
    for horse in named:
        id=horse["id"];wikiRow=byFame.get(id,{})
        text=wikiExtracts.get(id,"")
        introWins,record=wiki_lead(text)
        wins=[]
        for row in rawWins.get(id,[]):
            if row["qid"] not in winLabels:continue
            label=winLabels[row["qid"]]
            # Keep this as a structured item fact, never raw prose.
            if len(label)>90:continue
            candidate={"race":label,"year":row["year"]}
            if not any(x["race"]==candidate["race"] for x in wins):wins.append(candidate)
        for candidate in introWins:
            if not any(x["race"]==candidate["race"] for x in wins):wins.append(candidate)
        wins=wins[:8]
        sourceLinks=[]
        if (wins and introWins) or record:
            url=wikiRow.get("articleUrl")
            if url and url.startswith(("https://ja.wikipedia.org/wiki/","https://en.wikipedia.org/wiki/")):
                sourceLinks.append({"label":"Wikipedia（レース実績）","url":url})
        if rawWins.get(id):
            sourceLinks.append({"label":"Wikidata（優勝歴）","url":horse["source"]})
        description=None
        if wikiRow.get("jraHall"):
            description="JRA顕彰馬に選出。"
            sourceLinks.append({"label":"JRA 競馬の殿堂","url":"https://www.jra.go.jp/gallery/dendo/"})
        # A source exists for every displayed win/record, and a source-unknown
        # event is never shown just because the horse is famous.
        if not sourceLinks:wins=[];record=None
        profiles[id]={"name":horse["name"],"majorWins":wins,"raceRecord":record,
                      "description":description,"sources":sourceLinks}
        counters["named"]+=1
        if text:counters["articleLeads"]+=1
        if rawWins.get(id):counters["wikidataVictoryQids"]+=1
        if introWins:counters["leadVictoryFacts"]+=1
        if wins:counters["withWins"]+=1
        if record:counters["withRaceRecord"]+=1
        if description:counters["withDescription"]+=1
        if wins or record or description:counters["withProfileFacts"]+=1
    now=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
    manifest={"version":"horse-profiles-v1","retrievedAtUTC":now,
      "pedigreeVersion":snapshot["version"],
      "sourceMethod":"Wikidata P2522 qualified winner items, Wikipedia exintro explicitly marked principal wins / career record; JRA honor from existing fame snapshot. No copied article prose.",
      "coverage":dict(counters),"horses":dict(sorted(profiles.items()))}
    OUTPUT.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    top=sorted(named,key=lambda h:-(byFame.get(h["id"],{}).get("views12m") or 0))[:40]
    lines=["# 競走馬プロフィール調査（872頭）","",
      "実行： "+now,"",
      "## カバレッジ","",
      "| 指標 | 頭数 |","| --- | ---: |"]
    lines += [f"| {key} | {value} |" for key,value in sorted(counters.items())]
    lines+=["","## 著作権と根拠","",
      "- Wikipediaの文章はコピーせず、明示された「主な勝ち鞍」「通算戦績」から単独の事実としてのみ抽出",
      "- 勝った事実の記載がないレース名は記載しない。記事の一般的な説明文から戦績を推測しない",
      "- Wikidata優勝歴 P2522 がある場合は競走名の項目を直接照合",
      "- レース記録がない馬の項目は非表示。血統上の親子名をプロフィールに表示して未解決の答えを漏らさない",
      "- Wikidata P2522 とWikipedia間で同名レースの異なる年度がある場合は掲載前に別途照合が必要",
      "- 競走馬の顔写真は別途既存のCommonsライセンス監査済みJSONだけを参照",
      "",
      "## 閲覧上位40頭のサンプル","",
      "| 馬名 | 主な勝ち鞍 | 戦績 | 一言 |","| --- | --- | --- | --- |"]
    for h in top:
        row=profiles[h["id"]]
        won="、".join(x["race"] for x in row["majorWins"][:3]) or "未収録"
        rec=row["raceRecord"]
        lines.append(f"| {h['name']} | {won} | {str(rec['starts'])+'戦'+str(rec['wins'])+'勝' if rec else '未収録'} | {row['description'] or '—'} |")
    lines += ["","## API取得エラー（最大30件）",""]
    lines += [f"- {e}" for e in errors[:30]] or ["- なし"]
    REPORT.write_text("\n".join(lines)+"\n","utf8")
    print("HORSE_PROFILE_AUDIT="+json.dumps({
      "coverage":dict(counters),"top40WithFact":sum(bool(profiles[h["id"]]["majorWins"] or profiles[h["id"]]["raceRecord"] or profiles[h["id"]]["description"]) for h in top),
      "errors":errors[:6],"examples":{h["name"]:profiles[h["id"]]["majorWins"][:3] for h in top[:7]}
    },ensure_ascii=False))
    if len(entities)<len(named)*.75:raise RuntimeError("Insufficient Wikidata response, refusing to trust incomplete report")
    if len(wikiExtracts)<len(named)*.70:raise RuntimeError("Insufficient Wikipedia response, refusing to trust incomplete report")
if __name__=="__main__":main()
