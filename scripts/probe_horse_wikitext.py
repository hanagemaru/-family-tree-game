#!/usr/bin/env python3
"""One-off inspection of source infobox fields for broad, source-backed horse profile coverage."""
import json, urllib.parse, urllib.request, re
headers={"User-Agent":"HanageHorseProfileResearch/0.2 (https://github.com/hanagemaru/-family-tree-game)","Accept":"application/json"}
cases={"ja":["ダンツフレーム","ゴールドシップ","カレンブーケドール","ポイントフラッグ","デアリングバード","キングヘイロー"],
       "en":["Northern Dancer","Mr. Prospector","Nijinsky (horse)"]}
for lang,titles in cases.items():
 url=f"https://{lang}.wikipedia.org/w/api.php?"+urllib.parse.urlencode({"action":"query","prop":"revisions","rvprop":"content","rvslots":"main","titles":"|".join(titles),"format":"json","formatversion":2})
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=50) as f:data=json.load(f)
 except Exception as e:
  print("PROBE_ERROR",lang,str(e));continue
 for page in data.get("query",{}).get("pages",[]):
  title=page.get("title","?")
  raw=page.get("revisions",[{}])[0].get("slots",{}).get("main",{}).get("content","")
  print("PAGE",lang,title,"SIZE",len(raw))
  for line in raw.splitlines()[:115]:
   if re.search(r"\||record|勝ち鞍|生涯成績|成績|種牡馬|繁殖牝馬|stat",line,re.I):
    print("  ",line[:230])
