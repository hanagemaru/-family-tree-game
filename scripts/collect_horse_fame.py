#!/usr/bin/env python3
"""Build an auditable horse-familiarity snapshot; run on CI, not in the browser.

Wikidata QIDs identify horses, not their names. Wikimedia per-article pageviews are
CC0. JRA hall-of-fame names are a curated exact-name lookup against the official
historical list; they must never be interpreted as GI win counts.
"""
import argparse
import concurrent.futures
import datetime as dt
import json
import pathlib
import time
import urllib.error
import urllib.parse
import urllib.request

USER_AGENT = "HanageHorsePedigree/1.0 (https://hanage.app; https://github.com/hanagemaru/-family-tree-game)"
WIKIDATA_API = "https://www.wikidata.org/w/api.php"
VIEWS_API = "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article"
JRA_HALL = "https://www.jra.go.jp/gallery/dendo/"
JRA_HALL_NAMES = set("""クモハタ セントライト クリフジ トキツカゼ トサミドリ トキノミノル メイヂヒカリ ハクチカラ セイユウ コダマ シンザン スピードシンボリ タケシバオー グランドマーチス ハイセイコー トウショウボーイ テンポイント マルゼンスキー ミスターシービー シンボリルドルフ メジロラモーヌ オグリキャップ メジロマックイーン トウカイテイオー ナリタブライアン タイキシャトル エルコンドルパサー テイエムオペラオー キングカメハメハ ディープインパクト ウオッカ オルフェーヴル ロードカナロア ジェンティルドンナ オジュウチョウサン キタサンブラック アーモンドアイ コントレイル イクイノックス""".split())


def request_json(url, attempts=4):
    for i in range(attempts):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=45) as response:
                return json.load(response)
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                return None
            if exc.code not in (429, 500, 502, 503, 504) or i == attempts - 1:
                raise
            delay = min(30, 2 ** (i + 1))
            retry_after = exc.headers.get("Retry-After")
            if retry_after and retry_after.isdigit():
                delay = min(60, max(delay, int(retry_after)))
            time.sleep(delay)
        except (urllib.error.URLError, TimeoutError):
            if i == attempts - 1:
                raise
            time.sleep(2 ** (i + 1))
    raise RuntimeError("unreachable")


def wikidata_sitelinks(ids):
    result = {}
    for start in range(0, len(ids), 50):
        batch = ids[start:start + 50]
        params = urllib.parse.urlencode({
            "action": "wbgetentities", "ids": "|".join(batch),
            "props": "sitelinks", "format": "json",
        })
        data = request_json(WIKIDATA_API + "?" + params)
        entities = data.get("entities", {}) if data else {}
        for qid in batch:
            entity = entities.get(qid, {})
            links = entity.get("sitelinks", {})
            project = "ja.wikipedia.org" if "jawiki" in links else (
                "en.wikipedia.org" if "enwiki" in links else None
            )
            title = (links.get("jawiki") or links.get("enwiki") or {}).get("title")
            result[qid] = {
                "project": project,
                "article": title,
                "sitelinks": len(links),
            }
        time.sleep(0.25)
    return result


def views_for(item, start_stamp, end_stamp):
    project, title = item["project"], item["article"]
    if not project or not title:
        return None
    encoded_project = urllib.parse.quote(project, safe="")
    encoded_title = urllib.parse.quote(title.replace(" ", "_"), safe="")
    url = f"{VIEWS_API}/{encoded_project}/all-access/user/{encoded_title}/monthly/{start_stamp}/{end_stamp}"
    result = request_json(url)
    if result is None:
        return None
    return sum(int(row["views"]) for row in result.get("items", []))


def collect(pedigree, end_month, workers=3):
    named = [horse for horse in pedigree["horses"] if horse.get("named")]
    ids = [horse["id"] for horse in named]
    # 12 full calendar months, ending at the first day of the *next* month.
    last_year, last_month = map(int, end_month.split("-"))
    end_exclusive = dt.date(last_year + (last_month == 12), (last_month % 12) + 1, 1)
    start = dt.date(end_exclusive.year - 1, end_exclusive.month, 1)
    end_day = end_exclusive - dt.timedelta(days=1)
    stamp = lambda d: d.strftime("%Y%m%d") + "00"
    links = wikidata_sitelinks(ids)
    views, errors = {}, {}
    def get_one(qid):
        try:
            return qid, views_for(links[qid], stamp(start), stamp(end_day)), None
        except (urllib.error.URLError, TimeoutError, ValueError, KeyError) as exc:
            return qid, None, str(exc)
    # Low concurrency and retry/back-off to respect Wikimedia rate limits.
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        for qid, count, error in executor.map(get_one, ids):
            views[qid] = count
            if error:
                errors[qid] = error

    horses = []
    for horse in named:
        qid = horse["id"]
        site = links[qid]
        article_url = ("https://" + site["project"] + "/wiki/" + urllib.parse.quote(site["article"].replace(" ", "_"), safe="()")
                       if site["project"] and site["article"] else None)
        horses.append({
            "id": qid,
            "views12m": views[qid],
            "article": site["article"],
            "project": site["project"],
            "articleUrl": article_url,
            "sitelinks": site["sitelinks"],
            "jraHall": horse["name"] in JRA_HALL_NAMES,
        })
    horses.sort(key=lambda row: row["id"])
    observed = sum(row["views12m"] is not None for row in horses)
    return {
        "version": "horse-fame-v1",
        "pedigreeVersion": pedigree["version"],
        "period": {"from": start.isoformat(), "through": end_day.isoformat()},
        "method": "Wikimedia Analytics 12 full months; JRA official hall-of-fame exact-name list; missing pageviews are null, never zero",
        "sources": [
            {"label": "Wikidata sitelinks (CC0)", "url": WIKIDATA_API},
            {"label": "Wikimedia Analytics (CC0)", "url": "https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/documentation/access-policy.html"},
            {"label": "JRA 歴代顕彰馬", "url": JRA_HALL},
        ],
        "coverage": {"named": len(named), "observedViews": observed,
                     "noArticleOrUnavailable": len(named) - observed,
                     "requestErrors": len(errors)},
        "horses": horses,
        "requestErrors": errors,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pedigree", default="data/horse-pedigree.v1.json")
    parser.add_argument("--output", default="data/horse-fame.v1.json")
    parser.add_argument("--end-month", help="last complete calendar month, YYYY-MM")
    parser.add_argument("--workers", type=int, default=3)
    args = parser.parse_args()
    today = dt.date.today()
    previous = today.replace(day=1) - dt.timedelta(days=1)
    end_month = args.end_month or previous.strftime("%Y-%m")
    if not 1 <= args.workers <= 4:
        parser.error("workers must be 1..4")
    pedigree = json.loads(pathlib.Path(args.pedigree).read_text(encoding="utf8"))
    result = collect(pedigree, end_month, args.workers)
    output = pathlib.Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    print(json.dumps({"period": result["period"], "coverage": result["coverage"], "output": str(output)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
